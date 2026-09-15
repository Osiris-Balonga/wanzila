import { execFile } from "node:child_process";
import type { OutgoingHttpHeaders } from "node:http";
import { promisify } from "node:util";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  createPrismaClient,
  type ApiPrismaClient,
} from "../src/infrastructure/prisma.js";
import {
  ADMINISTRATOR,
  bootstrapAdministrator,
  clearAdministratorFixtures,
  registerProtectedAdministratorTestRoute,
  WEB_ORIGIN,
  workspaceRoot,
} from "./support/admin-auth-fixtures.js";
import {
  administratorSessionResponseSchema,
  authenticationErrorSchema,
  protectedAdministratorResponseSchema,
  signInRequestSchema,
  signedOutResponseSchema,
} from "./support/admin-auth-contract.js";
import { getDisposableTestDatabaseUrl } from "./support/test-database.js";

const execFileAsync = promisify(execFile);
const testDatabaseUrl = getDisposableTestDatabaseUrl(process.env);
const disposableTestDatabaseUrl = testDatabaseUrl ?? "";
const runMariaDbTests = Boolean(testDatabaseUrl);
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;
const SESSION_LIFETIME_MS = SESSION_LIFETIME_SECONDS * 1000;

const authenticationRequired = {
  error: {
    code: "AUTHENTICATION_REQUIRED",
    message: "Authentication required",
  },
};

const authenticationFailed = {
  error: {
    code: "AUTHENTICATION_FAILED",
    message: "Invalid email or password",
  },
};

const forbiddenOrigin = {
  error: {
    code: "ORIGIN_FORBIDDEN",
    message: "Request origin is not allowed",
  },
};

function bootstrapEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: disposableTestDatabaseUrl,
    NODE_ENV: "test",
    WZ_ADMIN_BOOTSTRAP_EMAIL: ADMINISTRATOR.email,
    WZ_ADMIN_BOOTSTRAP_PASSWORD: ADMINISTRATOR.password,
    WZ_ADMIN_BOOTSTRAP_DISPLAY_NAME: ADMINISTRATOR.displayName,
  };
}

function setCookie(response: { headers: OutgoingHttpHeaders }) {
  const header = response.headers["set-cookie"];
  if (Array.isArray(header)) {
    return header[0] ?? "";
  }
  return typeof header === "string" ? header : "";
}

function sessionCookie(setCookieHeader: string): string {
  const match = /^wanzila_admin_session=([^;]+)/.exec(setCookieHeader);
  if (!match) {
    throw new Error("Expected a wanzila_admin_session cookie.");
  }
  return `wanzila_admin_session=${match[1]}`;
}

function cookieToken(cookie: string): string {
  return cookie.split("=", 2)[1] ?? "";
}

function contentTypeHeaders() {
  return { "content-type": "application/json" };
}

describe.runIf(runMariaDbTests)(
  "administrator authentication HTTP contract (MariaDB)",
  () => {
    let prisma: ApiPrismaClient;
    let app: Awaited<ReturnType<typeof createApp>> | undefined;
    let now = new Date("2026-09-15T12:00:00.000Z");

    beforeAll(async () => {
      const command = "pnpm --filter @wanzila/api db:migrate";
      const shell =
        process.platform === "win32"
          ? { file: "cmd.exe", args: ["/d", "/s", "/c", command] }
          : { file: "sh", args: ["-c", command] };
      await execFileAsync(shell.file, shell.args, {
        cwd: workspaceRoot,
        env: { ...process.env, DATABASE_URL: disposableTestDatabaseUrl },
      });
    }, 60_000);

    beforeEach(async () => {
      now = new Date("2026-09-15T12:00:00.000Z");
      prisma = createPrismaClient(disposableTestDatabaseUrl);
      await clearAdministratorFixtures(prisma);
    });

    afterEach(async () => {
      if (app) {
        await app.close();
        app = undefined;
        return;
      }
      await prisma.$disconnect();
    });

    async function openApp(
      nodeEnvironment: "test" | "production" = "test",
      rateLimitMax?: number,
    ) {
      const options = {
        webOrigin: WEB_ORIGIN,
        prisma,
        now: () => now,
        nodeEnvironment,
        ...(rateLimitMax === undefined ? {} : { rateLimitMax }),
      };
      app = await createApp(options);
      return app;
    }

    async function bootstrapFixture() {
      const result = await bootstrapAdministrator(bootstrapEnvironment());
      expect(result.exitCode).toBe(0);
      expect(result.output).not.toContain(ADMINISTRATOR.password);
      return prisma.adminUser.findUniqueOrThrow({
        where: { email: ADMINISTRATOR.email },
      });
    }

    async function signIn(
      application: Awaited<ReturnType<typeof createApp>>,
      origin: string | undefined = WEB_ORIGIN,
    ) {
      const request = signInRequestSchema.parse({
        email: ADMINISTRATOR.email,
        password: ADMINISTRATOR.password,
      });
      const response = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: {
          ...contentTypeHeaders(),
          ...(origin === undefined ? {} : { origin }),
        },
        payload: request,
      });
      expect(response.statusCode).toBe(200);
      return {
        response,
        session: administratorSessionResponseSchema.parse(response.json()).data,
        setCookie: setCookie(response),
      };
    }

    it("rejects anonymous current-session requests with the stable authentication envelope", async () => {
      const application = await openApp();

      const response = await application.inject({
        method: "GET",
        url: "/api/v1/admin/auth/session",
      });

      expect(response.statusCode).toBe(401);
      expect(authenticationErrorSchema.parse(response.json())).toEqual(
        authenticationRequired,
      );
    });

    it("signs in an administrator, validates strict JSON contracts, and persists only a token digest", async () => {
      const administrator = await bootstrapFixture();
      const application = await openApp("production");
      const signedIn = await signIn(application);
      const cookie = sessionCookie(signedIn.setCookie);
      const token = cookieToken(cookie);

      expect(signedIn.session).toMatchObject({
        administrator: {
          id: administrator.id,
          email: ADMINISTRATOR.email,
          displayName: ADMINISTRATOR.displayName,
        },
      });
      expect(JSON.stringify(signedIn.response.json())).not.toContain(
        ADMINISTRATOR.password,
      );
      expect(JSON.stringify(signedIn.response.json())).not.toContain(token);
      expect(
        new Date(signedIn.session.expiresAt).getTime() - now.getTime(),
      ).toBe(SESSION_LIFETIME_MS);
      expect(signedIn.setCookie.split("; ")).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^wanzila_admin_session=[^;]+$/),
          "HttpOnly",
          "SameSite=Lax",
          "Path=/",
          "Secure",
        ]),
      );
      const maxAge = /(?:^|; )Max-Age=(\d+)(?:;|$)/.exec(signedIn.setCookie);
      expect(maxAge?.[1]).toBeDefined();
      expect(Number(maxAge?.[1])).toBe(SESSION_LIFETIME_SECONDS);

      const sessions = await prisma.$queryRawUnsafe<
        Array<{ tokenDigest: string; expiresAt: Date }>
      >(
        "SELECT tokenDigest, expiresAt FROM AdminSession WHERE adminUserId = ?",
        administrator.id,
      );
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.tokenDigest).not.toBe(token);
      expect(sessions[0]?.tokenDigest).not.toContain(token);
      expect(sessions[0]?.expiresAt.toISOString()).toBe(
        signedIn.session.expiresAt,
      );

      const malformed = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: contentTypeHeaders(),
        payload: { ...ADMINISTRATOR, unexpected: true },
      });
      expect(malformed.statusCode).toBe(400);
      expect(authenticationErrorSchema.parse(malformed.json())).toEqual({
        error: { code: "BAD_REQUEST", message: "Invalid request parameters" },
      });
    });

    it("requires the configured Origin before every sign-in attempt", async () => {
      await bootstrapFixture();
      const application = await openApp();

      const missingOrigin = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: contentTypeHeaders(),
        payload: {
          email: ADMINISTRATOR.email,
          password: ADMINISTRATOR.password,
        },
      });
      const foreignOrigin = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: {
          ...contentTypeHeaders(),
          origin: "https://attacker.example",
        },
        payload: {
          email: ADMINISTRATOR.email,
          password: ADMINISTRATOR.password,
        },
      });

      expect(missingOrigin.statusCode).toBe(403);
      expect(foreignOrigin.statusCode).toBe(403);
      expect(authenticationErrorSchema.parse(missingOrigin.json())).toEqual(
        forbiddenOrigin,
      );
      expect(authenticationErrorSchema.parse(foreignOrigin.json())).toEqual(
        forbiddenOrigin,
      );
      await expect(
        prisma.$queryRawUnsafe<Array<{ tokenDigest: string }>>(
          "SELECT tokenDigest FROM AdminSession",
        ),
      ).resolves.toEqual([]);
    });

    it("does not reveal whether invalid credentials name an existing administrator", async () => {
      const administrator = await bootstrapFixture();
      const application = await openApp();

      const unknownUser = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: { ...contentTypeHeaders(), origin: WEB_ORIGIN },
        payload: {
          email: "unknown@wanzila.test",
          password: ADMINISTRATOR.password,
        },
      });
      const wrongPassword = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: { ...contentTypeHeaders(), origin: WEB_ORIGIN },
        payload: { email: administrator.email, password: "wrong-password" },
      });

      expect(unknownUser.statusCode).toBe(401);
      expect(wrongPassword.statusCode).toBe(401);
      const unknownBody = authenticationErrorSchema.parse(unknownUser.json());
      const wrongPasswordBody = authenticationErrorSchema.parse(
        wrongPassword.json(),
      );
      expect(unknownBody).toEqual(authenticationFailed);
      expect(wrongPasswordBody).toEqual(unknownBody);
    });

    it("expires sessions with the injected clock, revokes sign-out, and rejects replay", async () => {
      await bootstrapFixture();
      const application = await openApp();
      const signedIn = await signIn(application);
      const cookie = sessionCookie(signedIn.setCookie);

      const current = await application.inject({
        method: "GET",
        url: "/api/v1/admin/auth/session",
        headers: { cookie },
      });
      expect(current.statusCode).toBe(200);
      expect(administratorSessionResponseSchema.parse(current.json())).toEqual({
        data: signedIn.session,
      });

      const expiresAt = new Date(signedIn.session.expiresAt);
      now = new Date(expiresAt.getTime() - 1);
      const beforeExpiry = await application.inject({
        method: "GET",
        url: "/api/v1/admin/auth/session",
        headers: { cookie },
      });
      expect(beforeExpiry.statusCode).toBe(200);
      expect(
        administratorSessionResponseSchema.parse(beforeExpiry.json()),
      ).toEqual({ data: signedIn.session });

      now = expiresAt;
      const expired = await application.inject({
        method: "GET",
        url: "/api/v1/admin/auth/session",
        headers: { cookie },
      });
      expect(expired.statusCode).toBe(401);
      expect(authenticationErrorSchema.parse(expired.json())).toEqual(
        authenticationRequired,
      );

      now = new Date("2026-09-15T12:00:00.000Z");
      const freshSignIn = await signIn(application);
      const freshCookie = sessionCookie(freshSignIn.setCookie);
      const signedOut = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-out",
        headers: { origin: WEB_ORIGIN, cookie: freshCookie },
      });
      expect(signedOut.statusCode).toBe(200);
      expect(signedOutResponseSchema.parse(signedOut.json())).toEqual({
        data: { signedOut: true },
      });
      expect(setCookie(signedOut).split("; ")).toEqual(
        expect.arrayContaining([
          "wanzila_admin_session=",
          "HttpOnly",
          "SameSite=Lax",
          "Path=/",
          "Max-Age=0",
        ]),
      );
      const revokedSessions = await prisma.$queryRawUnsafe<
        Array<{ revokedAt: Date | null }>
      >("SELECT revokedAt FROM AdminSession WHERE revokedAt IS NOT NULL");
      expect(revokedSessions).toHaveLength(1);
      expect(revokedSessions[0]?.revokedAt).toBeInstanceOf(Date);

      const replay = await application.inject({
        method: "GET",
        url: "/api/v1/admin/auth/session",
        headers: { cookie: freshCookie },
      });
      expect(replay.statusCode).toBe(401);
      expect(authenticationErrorSchema.parse(replay.json())).toEqual(
        authenticationRequired,
      );
    });

    it("rejects cookie-authenticated mutations without an allowed Origin and parses sign-out strictly", async () => {
      await bootstrapFixture();
      const application = await openApp();
      const signedIn = await signIn(application);
      const cookie = sessionCookie(signedIn.setCookie);

      const missingOrigin = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-out",
        headers: { cookie },
      });
      const foreignOrigin = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-out",
        headers: { cookie, origin: "https://attacker.example" },
      });
      expect(missingOrigin.statusCode).toBe(403);
      expect(foreignOrigin.statusCode).toBe(403);
      expect(authenticationErrorSchema.parse(missingOrigin.json())).toEqual(
        forbiddenOrigin,
      );
      expect(authenticationErrorSchema.parse(foreignOrigin.json())).toEqual(
        forbiddenOrigin,
      );

      const malformed = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-out",
        headers: { ...contentTypeHeaders(), cookie, origin: WEB_ORIGIN },
        payload: { unexpected: true },
      });
      expect(malformed.statusCode).toBe(400);
      expect(authenticationErrorSchema.parse(malformed.json())).toEqual({
        error: { code: "BAD_REQUEST", message: "Invalid request parameters" },
      });
    });

    it("reuses authorization and Origin guards for a protected administrator mutation", async () => {
      await bootstrapFixture();
      const application = await openApp();
      await registerProtectedAdministratorTestRoute(
        application,
        prisma,
        () => now,
      );
      const signedIn = await signIn(application);
      const cookie = sessionCookie(signedIn.setCookie);

      const anonymous = await application.inject({
        method: "POST",
        url: "/api/v1/admin/test-only/protected",
        headers: { origin: WEB_ORIGIN },
      });
      expect(anonymous.statusCode).toBe(401);
      expect(authenticationErrorSchema.parse(anonymous.json())).toEqual(
        authenticationRequired,
      );

      const missingOrigin = await application.inject({
        method: "POST",
        url: "/api/v1/admin/test-only/protected",
        headers: { cookie },
      });
      const foreignOrigin = await application.inject({
        method: "POST",
        url: "/api/v1/admin/test-only/protected",
        headers: { cookie, origin: "https://attacker.example" },
      });
      expect(missingOrigin.statusCode).toBe(403);
      expect(foreignOrigin.statusCode).toBe(403);
      expect(authenticationErrorSchema.parse(missingOrigin.json())).toEqual(
        forbiddenOrigin,
      );
      expect(authenticationErrorSchema.parse(foreignOrigin.json())).toEqual(
        forbiddenOrigin,
      );

      const authorized = await application.inject({
        method: "POST",
        url: "/api/v1/admin/test-only/protected",
        headers: { cookie, origin: WEB_ORIGIN },
      });
      expect(authorized.statusCode).toBe(200);
      expect(
        protectedAdministratorResponseSchema.parse(authorized.json()),
      ).toEqual({ data: { scope: "administrator" } });
    });

    it("limits sign-in to five attempts per minute without charging health or public traffic", async () => {
      const application = await openApp("test", 100);
      const request = {
        email: "unknown@wanzila.test",
        password: "invalid-password",
      };

      const first = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: { ...contentTypeHeaders(), origin: WEB_ORIGIN },
        payload: request,
      });
      expect(first.statusCode).toBe(401);

      const health = await application.inject({
        method: "GET",
        url: "/api/v1/health",
      });
      const publicApi = await application.inject({
        method: "GET",
        url: "/api/v1/pharmacies",
      });
      expect(health.statusCode).toBe(200);
      expect(publicApi.statusCode).toBe(200);

      const remainingAttempts = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        remainingAttempts.push(
          await application.inject({
            method: "POST",
            url: "/api/v1/admin/auth/sign-in",
            headers: { ...contentTypeHeaders(), origin: WEB_ORIGIN },
            payload: request,
          }),
        );
      }
      expect(remainingAttempts.map((response) => response.statusCode)).toEqual([
        401, 401, 401, 401,
      ]);

      const limited = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: { ...contentTypeHeaders(), origin: WEB_ORIGIN },
        payload: request,
      });
      expect(limited.statusCode).toBe(429);
      expect(authenticationErrorSchema.parse(limited.json())).toEqual({
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      });
    });

    it("does not inherit a lower global rate limit for sign-in", async () => {
      const application = await openApp("test", 1);
      const health = await application.inject({
        method: "GET",
        url: "/api/v1/health",
      });
      expect(health.statusCode).toBe(200);

      const signInAfterHealth = await application.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: { ...contentTypeHeaders(), origin: WEB_ORIGIN },
        payload: {
          email: "unknown@wanzila.test",
          password: "invalid-password",
        },
      });
      expect(signInAfterHealth.statusCode).toBe(401);
    });
  },
);
