import { execFile } from "node:child_process";
import type { OutgoingHttpHeaders } from "node:http";
import { promisify } from "node:util";
import {
  pharmacyDetailResponseSchema,
  pharmacyListResponseSchema,
} from "@wanzila/contracts";
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
  WEB_ORIGIN,
  workspaceRoot,
} from "./support/admin-auth-fixtures.js";
import {
  adminPharmacyErrorSchema,
  adminPharmacyListQuerySchema,
  adminPharmacyListResponseSchema,
  adminPharmacyResponseSchema,
  createAdminPharmacyRequestSchema,
  updateAdminPharmacyRequestSchema,
} from "./support/admin-pharmacy-contract.js";
import { getDisposableTestDatabaseUrl } from "./support/test-database.js";

const execFileAsync = promisify(execFile);
const testDatabaseUrl = getDisposableTestDatabaseUrl(process.env);
const disposableTestDatabaseUrl = testDatabaseUrl ?? "";
const runMariaDbTests = Boolean(testDatabaseUrl);
const NOW = new Date("2026-09-15T12:00:00.000Z");

const ids = {
  alpha: "00000000-0000-4000-8000-000000009101",
  bravo: "00000000-0000-4000-8000-000000009102",
  draft: "00000000-0000-4000-8000-000000009103",
  archived: "00000000-0000-4000-8000-000000009104",
  missing: "00000000-0000-4000-8000-000000009199",
  duty: "00000000-0000-4000-8000-000000009201",
} as const;

const draftInput = {
  name: "Pharmacie Nouvelle",
  address: {
    line: "42 avenue de la Paix",
    district: "Plateau",
    arrondissement: "Poto-Poto",
  },
  phone: "+242060009999",
  coordinates: { latitude: -4.263708, longitude: 15.242885 },
};

function contentTypeHeaders() {
  return { "content-type": "application/json" };
}

function setCookie(response: { headers: OutgoingHttpHeaders }): string {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") {
    throw new Error("Expected an administrator session cookie.");
  }
  const match = /^wanzila_admin_session=([^;]+)/.exec(value);
  if (!match) {
    throw new Error("Expected a wanzila_admin_session cookie.");
  }
  return `wanzila_admin_session=${match[1]}`;
}

async function clearFixtures(prisma: ApiPrismaClient): Promise<void> {
  await prisma.dutyException.deleteMany();
  await prisma.dutyPeriod.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.report.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.scheduleSource.deleteMany();
  await prisma.pharmacy.deleteMany();
  await clearAdministratorFixtures(prisma);
}

async function createFixtures(prisma: ApiPrismaClient): Promise<void> {
  await prisma.pharmacy.createMany({
    data: [
      {
        id: ids.alpha,
        name: "Pharmacie Alpha",
        address: "1 avenue de la Paix",
        district: "Plateau",
        arrondissement: "Poto-Poto",
        latitude: "-4.2637080",
        longitude: "15.2428850",
        status: "PUBLISHED",
      },
      {
        id: ids.bravo,
        name: "Pharmacie Bravo",
        address: "2 avenue de la Paix",
        district: "Plateau",
        arrondissement: "Moungali",
        latitude: "-4.2637000",
        longitude: "15.2428000",
        status: "PUBLISHED",
      },
      {
        id: ids.draft,
        name: "Pharmacie Brouillon",
        address: "3 avenue du Marché",
        district: "Bacongo",
        arrondissement: "Bacongo",
        latitude: "-4.2600000",
        longitude: "15.2400000",
        status: "DRAFT",
      },
      {
        id: ids.archived,
        name: "Pharmacie Archivée",
        address: "4 avenue du Marché",
        district: "Bacongo",
        arrondissement: "Bacongo",
        latitude: "-4.2610000",
        longitude: "15.2410000",
        status: "ARCHIVED",
      },
    ],
  });
}

describe("admin pharmacy directory test contracts", () => {
  it("keeps all request and response objects strict", () => {
    expect(() =>
      createAdminPharmacyRequestSchema.parse({
        ...draftInput,
        unexpected: true,
      }),
    ).toThrow();
    expect(() => updateAdminPharmacyRequestSchema.parse({})).toThrow(
      "At least one pharmacy field is required.",
    );
    expect(() =>
      adminPharmacyListQuerySchema.parse({ status: "PUBLISHED", extra: "no" }),
    ).toThrow();
    expect(() =>
      adminPharmacyResponseSchema.parse({
        data: {
          id: ids.alpha,
          ...draftInput,
          status: "DRAFT",
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          unexpected: true,
        },
      }),
    ).toThrow();
  });
});

describe.runIf(runMariaDbTests)(
  "admin pharmacy directory HTTP contract (MariaDB)",
  () => {
    let prisma: ApiPrismaClient;
    let app: Awaited<ReturnType<typeof createApp>>;
    let administratorCookie: string;

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
      prisma = createPrismaClient(disposableTestDatabaseUrl);
      await clearFixtures(prisma);
      const bootstrap = await bootstrapAdministrator({
        ...process.env,
        DATABASE_URL: disposableTestDatabaseUrl,
        NODE_ENV: "test",
        WZ_ADMIN_BOOTSTRAP_EMAIL: ADMINISTRATOR.email,
        WZ_ADMIN_BOOTSTRAP_PASSWORD: ADMINISTRATOR.password,
        WZ_ADMIN_BOOTSTRAP_DISPLAY_NAME: ADMINISTRATOR.displayName,
      });
      if (bootstrap.exitCode !== 0) {
        throw new Error(`Administrator bootstrap failed: ${bootstrap.output}`);
      }
      await createFixtures(prisma);
      app = await createApp({
        prisma,
        webOrigin: WEB_ORIGIN,
        now: () => NOW,
        nodeEnvironment: "test",
      });
      const signedIn = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/sign-in",
        headers: { ...contentTypeHeaders(), origin: WEB_ORIGIN },
        payload: {
          email: ADMINISTRATOR.email,
          password: ADMINISTRATOR.password,
        },
      });
      expect(signedIn.statusCode).toBe(200);
      administratorCookie = setCookie(signedIn);
    });

    afterEach(async () => {
      await app.close();
    });

    it("lists every publication state with strict filters, stable ordering, and pagination metadata", async () => {
      const first = await app.inject({
        method: "GET",
        url: "/api/v1/admin/pharmacies?page=1&pageSize=2",
        headers: { cookie: administratorCookie },
      });
      expect(first.statusCode).toBe(200);
      expect(adminPharmacyListResponseSchema.parse(first.json())).toMatchObject(
        {
          data: [
            { id: ids.archived, status: "ARCHIVED" },
            { id: ids.alpha, status: "PUBLISHED" },
          ],
          pagination: { page: 1, pageSize: 2, total: 4, totalPages: 2 },
        },
      );

      const second = await app.inject({
        method: "GET",
        url: "/api/v1/admin/pharmacies?page=2&pageSize=2",
        headers: { cookie: administratorCookie },
      });
      expect(second.statusCode).toBe(200);
      expect(
        adminPharmacyListResponseSchema.parse(second.json()).data,
      ).toMatchObject([{ id: ids.bravo }, { id: ids.draft }]);

      const filtered = await app.inject({
        method: "GET",
        url: "/api/v1/admin/pharmacies?name=alpha&district=Plateau&arrondissement=Poto-Poto&status=PUBLISHED",
        headers: { cookie: administratorCookie },
      });
      expect(filtered.statusCode).toBe(200);
      expect(
        adminPharmacyListResponseSchema.parse(filtered.json()).data,
      ).toMatchObject([
        { id: ids.alpha, name: "Pharmacie Alpha", status: "PUBLISHED" },
      ]);
    });

    it("returns an authenticated administrator detail including draft and archived records", async () => {
      const detail = await app.inject({
        method: "GET",
        url: `/api/v1/admin/pharmacies/${ids.archived}`,
        headers: { cookie: administratorCookie },
      });
      expect(detail.statusCode).toBe(200);
      expect(adminPharmacyResponseSchema.parse(detail.json())).toMatchObject({
        data: {
          id: ids.archived,
          name: "Pharmacie Archivée",
          status: "ARCHIVED",
          address: { district: "Bacongo", arrondissement: "Bacongo" },
        },
      });
    });

    it("creates a normalized DRAFT only and persists it for subsequent administrative reads", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/admin/pharmacies",
        headers: {
          ...contentTypeHeaders(),
          cookie: administratorCookie,
          origin: WEB_ORIGIN,
        },
        payload: draftInput,
      });
      expect(created.statusCode).toBe(201);
      const pharmacy = adminPharmacyResponseSchema.parse(created.json()).data;
      expect(pharmacy).toMatchObject({ ...draftInput, status: "DRAFT" });

      const detail = await app.inject({
        method: "GET",
        url: `/api/v1/admin/pharmacies/${pharmacy.id}`,
        headers: { cookie: administratorCookie },
      });
      expect(detail.statusCode).toBe(200);
      expect(
        adminPharmacyResponseSchema.parse(detail.json()).data,
      ).toMatchObject({
        id: pharmacy.id,
        status: "DRAFT",
      });
    });

    it("updates validated metadata, contact, and coordinates without changing its publication state", async () => {
      const updated = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/pharmacies/${ids.draft}`,
        headers: {
          ...contentTypeHeaders(),
          cookie: administratorCookie,
          origin: WEB_ORIGIN,
        },
        payload: {
          name: "Pharmacie Brouillon corrigée",
          phone: "+242060001234",
          coordinates: { latitude: -4.25, longitude: 15.25 },
        },
      });
      expect(updated.statusCode).toBe(200);
      expect(adminPharmacyResponseSchema.parse(updated.json())).toMatchObject({
        data: {
          id: ids.draft,
          name: "Pharmacie Brouillon corrigée",
          phone: "+242060001234",
          coordinates: { latitude: -4.25, longitude: 15.25 },
          status: "DRAFT",
        },
      });
    });

    it("publishes DRAFT records, archives DRAFT or PUBLISHED records, and rejects invalid repeated transitions atomically", async () => {
      const published = await app.inject({
        method: "POST",
        url: `/api/v1/admin/pharmacies/${ids.draft}/publish`,
        headers: { cookie: administratorCookie, origin: WEB_ORIGIN },
      });
      expect(published.statusCode).toBe(200);
      expect(
        adminPharmacyResponseSchema.parse(published.json()).data.status,
      ).toBe("PUBLISHED");

      const repeatedPublish = await app.inject({
        method: "POST",
        url: `/api/v1/admin/pharmacies/${ids.draft}/publish`,
        headers: { cookie: administratorCookie, origin: WEB_ORIGIN },
      });
      expect(repeatedPublish.statusCode).toBe(409);
      expect(adminPharmacyErrorSchema.parse(repeatedPublish.json())).toEqual({
        error: {
          code: "CONFLICT",
          message: "Invalid pharmacy status transition",
        },
      });

      const archived = await app.inject({
        method: "POST",
        url: `/api/v1/admin/pharmacies/${ids.draft}/archive`,
        headers: { cookie: administratorCookie, origin: WEB_ORIGIN },
      });
      expect(archived.statusCode).toBe(200);
      expect(
        adminPharmacyResponseSchema.parse(archived.json()).data.status,
      ).toBe("ARCHIVED");

      const repeatedArchive = await app.inject({
        method: "POST",
        url: `/api/v1/admin/pharmacies/${ids.draft}/archive`,
        headers: { cookie: administratorCookie, origin: WEB_ORIGIN },
      });
      expect(repeatedArchive.statusCode).toBe(409);
      expect(adminPharmacyErrorSchema.parse(repeatedArchive.json())).toEqual({
        error: {
          code: "CONFLICT",
          message: "Invalid pharmacy status transition",
        },
      });

      const terminalRecord = await app.inject({
        method: "GET",
        url: `/api/v1/admin/pharmacies/${ids.draft}`,
        headers: { cookie: administratorCookie },
      });
      expect(
        adminPharmacyResponseSchema.parse(terminalRecord.json()).data.status,
      ).toBe("ARCHIVED");
    });

    it("rejects trimmed and case-normalized duplicate creates with a deterministic conflict", async () => {
      const duplicate = await app.inject({
        method: "POST",
        url: "/api/v1/admin/pharmacies",
        headers: {
          ...contentTypeHeaders(),
          cookie: administratorCookie,
          origin: WEB_ORIGIN,
        },
        payload: {
          name: "  PHARMACIE ALPHA ",
          address: {
            line: " 1 AVENUE DE LA PAIX ",
            district: " plateau ",
            arrondissement: " POTO-POTO ",
          },
          coordinates: { latitude: -4.263708, longitude: 15.242885 },
        },
      });
      expect(duplicate.statusCode).toBe(409);
      expect(adminPharmacyErrorSchema.parse(duplicate.json())).toEqual({
        error: {
          code: "CONFLICT",
          message: "A matching pharmacy already exists",
        },
      });
    });

    it("enforces authentication, Origin, validation, not-found, and conflict error contracts", async () => {
      for (const request of [
        { method: "GET" as const, url: "/api/v1/admin/pharmacies" },
        {
          method: "GET" as const,
          url: `/api/v1/admin/pharmacies/${ids.alpha}`,
        },
        { method: "POST" as const, url: "/api/v1/admin/pharmacies" },
      ]) {
        const response = await app.inject(request);
        expect(response.statusCode).toBe(401);
        expect(adminPharmacyErrorSchema.parse(response.json()).error.code).toBe(
          "AUTHENTICATION_REQUIRED",
        );
      }

      for (const request of [
        {
          method: "POST" as const,
          url: "/api/v1/admin/pharmacies",
          payload: draftInput,
        },
        {
          method: "PATCH" as const,
          url: `/api/v1/admin/pharmacies/${ids.draft}`,
          payload: { name: "Mise à jour" },
        },
        {
          method: "POST" as const,
          url: `/api/v1/admin/pharmacies/${ids.draft}/publish`,
        },
        {
          method: "POST" as const,
          url: `/api/v1/admin/pharmacies/${ids.draft}/archive`,
        },
      ]) {
        for (const origin of [undefined, "https://foreign.example"]) {
          const response = await app.inject({
            ...request,
            headers: {
              ...contentTypeHeaders(),
              cookie: administratorCookie,
              ...(origin === undefined ? {} : { origin }),
            },
          });
          expect(response.statusCode).toBe(403);
          expect(
            adminPharmacyErrorSchema.parse(response.json()).error.code,
          ).toBe("ORIGIN_FORBIDDEN");
        }
      }

      const malformed = await app.inject({
        method: "POST",
        url: "/api/v1/admin/pharmacies",
        headers: {
          ...contentTypeHeaders(),
          cookie: administratorCookie,
          origin: WEB_ORIGIN,
        },
        payload: {
          ...draftInput,
          coordinates: { latitude: 91, longitude: 15 },
        },
      });
      expect(malformed.statusCode).toBe(400);
      expect(adminPharmacyErrorSchema.parse(malformed.json()).error.code).toBe(
        "BAD_REQUEST",
      );

      const missing = await app.inject({
        method: "GET",
        url: `/api/v1/admin/pharmacies/${ids.missing}`,
        headers: { cookie: administratorCookie },
      });
      expect(missing.statusCode).toBe(404);
      expect(adminPharmacyErrorSchema.parse(missing.json()).error.code).toBe(
        "NOT_FOUND",
      );
    });

    it("keeps publication separate from duty eligibility in a MariaDB write-to-public-read journey", async () => {
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/admin/pharmacies",
        headers: {
          ...contentTypeHeaders(),
          cookie: administratorCookie,
          origin: WEB_ORIGIN,
        },
        payload: draftInput,
      });
      expect(created.statusCode).toBe(201);
      const pharmacy = adminPharmacyResponseSchema.parse(created.json()).data;

      const published = await app.inject({
        method: "POST",
        url: `/api/v1/admin/pharmacies/${pharmacy.id}/publish`,
        headers: { cookie: administratorCookie, origin: WEB_ORIGIN },
      });
      expect(published.statusCode).toBe(200);

      const absentWithoutDuty = await app.inject({
        method: "GET",
        url: "/api/v1/pharmacies?pageSize=50",
      });
      expect(
        pharmacyListResponseSchema.parse(absentWithoutDuty.json()).data,
      ).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: pharmacy.id })]),
      );

      await prisma.dutyPeriod.create({
        data: {
          id: ids.duty,
          pharmacyId: pharmacy.id,
          status: "APPROVED",
          startsAt: new Date("2026-09-15T08:00:00.000Z"),
          endsAt: new Date("2026-09-15T20:00:00.000Z"),
        },
      });
      const publiclyEligible = await app.inject({
        method: "GET",
        url: `/api/v1/pharmacies/${pharmacy.id}`,
      });
      expect(publiclyEligible.statusCode).toBe(200);
      expect(
        pharmacyDetailResponseSchema.parse(publiclyEligible.json()).data,
      ).toMatchObject({
        id: pharmacy.id,
        currentDuty: { state: "ACTIVE" },
      });

      const archived = await app.inject({
        method: "POST",
        url: `/api/v1/admin/pharmacies/${pharmacy.id}/archive`,
        headers: { cookie: administratorCookie, origin: WEB_ORIGIN },
      });
      expect(archived.statusCode).toBe(200);
      const absentAfterArchive = await app.inject({
        method: "GET",
        url: `/api/v1/pharmacies/${pharmacy.id}`,
      });
      expect(absentAfterArchive.statusCode).toBe(404);
    });
  },
);
