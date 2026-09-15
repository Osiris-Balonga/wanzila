import argon2 from "argon2";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { ApiPrismaClient } from "../src/infrastructure/prisma.js";
import { DUMMY_ADMINISTRATOR_PASSWORD_HASH } from "../src/modules/admin-auth/routes.js";

const WEB_ORIGIN = "http://localhost:5173";
const STORED_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$rBjwqyfs5Uecr1LBJD0kVg$+ZkAerxe8Dr3RTMf0Ga4oHot7eFSHLiieHQrAutah0k";

function testPrisma(
  administrator: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
  } | null,
): ApiPrismaClient {
  return {
    adminUser: {
      findUnique: ({ where }: { where: { email: string } }) =>
        Promise.resolve(
          where.email === administrator?.email ? administrator : null,
        ),
    },
    $disconnect: () => Promise.resolve(undefined),
  } as unknown as ApiPrismaClient;
}

describe("administrator sign-in password verification", () => {
  const applications: Awaited<ReturnType<typeof createApp>>[] = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((app) => app.close()));
  });

  it("uses one password verification for both unknown and wrong-password credentials", async () => {
    const verificationHashes: string[] = [];
    const existingAdministrator = {
      id: "d7010ac2-b63f-48c7-bbf0-e2391e520f1d",
      email: "administrator.auth@wanzila.test",
      displayName: "Administratrice Wanzila",
      passwordHash: STORED_PASSWORD_HASH,
    };
    const app = await createApp({
      webOrigin: WEB_ORIGIN,
      prisma: testPrisma(existingAdministrator),
      verifyPassword: (hash) => {
        verificationHashes.push(hash);
        return Promise.resolve(false);
      },
    });
    applications.push(app);

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/sign-in",
      headers: { origin: WEB_ORIGIN, "content-type": "application/json" },
      payload: {
        email: existingAdministrator.email,
        password: "incorrect-password",
      },
    });

    const unknownEmail = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/sign-in",
      headers: { origin: WEB_ORIGIN, "content-type": "application/json" },
      payload: {
        email: "unknown@wanzila.test",
        password: "incorrect-password",
      },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(unknownEmail.json()).toEqual(wrongPassword.json());
    expect(verificationHashes).toEqual([
      STORED_PASSWORD_HASH,
      DUMMY_ADMINISTRATOR_PASSWORD_HASH,
    ]);
  });

  it("keeps a valid Argon2id dummy hash for unknown administrators", async () => {
    await expect(
      argon2.verify(
        DUMMY_ADMINISTRATOR_PASSWORD_HASH,
        "not-the-dummy-password",
      ),
    ).resolves.toBe(false);
  });
});
