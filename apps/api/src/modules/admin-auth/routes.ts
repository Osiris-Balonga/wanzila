import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import {
  administratorSignInRequestSchema,
  type AdministratorSessionResponse,
  type AdministratorSignedOutResponse,
} from "@wanzila/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiPrismaClient } from "../../infrastructure/prisma.js";
import {
  sendAuthenticationFailed,
  sendBadRequest,
} from "../shared/http-errors.js";
import {
  createAdministratorAuthorizationPreHandler,
  createAllowedOriginPreHandler,
  digestSessionToken,
  SESSION_COOKIE_NAME,
} from "./authorization.js";
import { createAuthenticationRateLimitPreHandler } from "./rate-limit.js";

const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;
const SESSION_LIFETIME_MS = SESSION_LIFETIME_SECONDS * 1000;
const signOutRequestSchema = z.object({}).strict();

/**
 * A fixed valid Argon2id hash makes unknown-email failures perform the same
 * expensive password verification as an existing administrator.
 */
export const DUMMY_ADMINISTRATOR_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$3aRFFFJw+4jVZ1qPEcgfRw$qCLmoUBqdJSUW5dAWtOcpIyMrt1+29MqIH5lhcJ2uUY";

type PasswordVerifier = (hash: string, password: string) => Promise<boolean>;

export interface AdministratorAuthRouteOptions {
  prisma: ApiPrismaClient | undefined;
  now: () => Date;
  webOrigin: string;
  nodeEnvironment: "development" | "test" | "production";
  verifyPassword?: PasswordVerifier;
}

function sessionCookieOptions(
  nodeEnvironment: AdministratorAuthRouteOptions["nodeEnvironment"],
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: nodeEnvironment === "production",
  };
}

export function registerAdministratorAuthRoutes(
  app: FastifyInstance,
  options: AdministratorAuthRouteOptions,
): void {
  const requireAllowedOrigin = createAllowedOriginPreHandler({
    webOrigin: options.webOrigin,
  });
  const requireAdministrator = createAdministratorAuthorizationPreHandler({
    prisma: options.prisma,
    now: options.now,
  });
  const limitAuthenticationAttempts = createAuthenticationRateLimitPreHandler();
  const cookieOptions = sessionCookieOptions(options.nodeEnvironment);
  const verifyPassword = options.verifyPassword ?? argon2.verify;

  app.post(
    "/api/v1/admin/auth/sign-in",
    {
      preHandler: [requireAllowedOrigin, limitAuthenticationAttempts],
      config: { rateLimit: false },
    },
    async (request, reply): Promise<AdministratorSessionResponse | void> => {
      const input = administratorSignInRequestSchema.safeParse(request.body);
      if (!input.success) {
        return sendBadRequest(reply);
      }

      if (!options.prisma) {
        return sendAuthenticationFailed(reply);
      }

      const administrator = await options.prisma.adminUser.findUnique({
        where: { email: input.data.email },
      });
      const passwordIsValid = await verifyPassword(
        administrator?.passwordHash ?? DUMMY_ADMINISTRATOR_PASSWORD_HASH,
        input.data.password,
      );
      if (!administrator || !passwordIsValid) {
        return sendAuthenticationFailed(reply);
      }

      const token = randomBytes(32).toString("base64url");
      const issuedAt = options.now();
      const expiresAt = new Date(issuedAt.getTime() + SESSION_LIFETIME_MS);
      await options.prisma.adminSession.create({
        data: {
          adminUserId: administrator.id,
          tokenDigest: digestSessionToken(token),
          expiresAt,
        },
      });
      reply.setCookie(SESSION_COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: SESSION_LIFETIME_SECONDS,
      });

      return {
        data: {
          administrator: {
            id: administrator.id,
            email: administrator.email,
            displayName: administrator.displayName,
          },
          expiresAt: expiresAt.toISOString(),
        },
      };
    },
  );

  app.get(
    "/api/v1/admin/auth/session",
    { preHandler: requireAdministrator },
    (request): AdministratorSessionResponse => ({
      data: request.administratorAuthentication!.session,
    }),
  );

  app.post(
    "/api/v1/admin/auth/sign-out",
    { preHandler: [requireAllowedOrigin, requireAdministrator] },
    async (request, reply): Promise<AdministratorSignedOutResponse | void> => {
      if (
        request.body !== undefined &&
        !signOutRequestSchema.safeParse(request.body).success
      ) {
        return sendBadRequest(reply);
      }

      if (!options.prisma) {
        return sendAuthenticationFailed(reply);
      }
      await options.prisma.adminSession.update({
        where: { id: request.administratorAuthentication!.sessionId },
        data: { revokedAt: options.now() },
      });
      reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
      return { data: { signedOut: true } };
    },
  );
}
