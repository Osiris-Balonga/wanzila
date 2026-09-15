import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ADMINISTRATOR,
  bootstrapAdministrator,
  clearAdministratorFixtures,
  workspaceRoot,
} from "./support/admin-auth-fixtures.js";
import {
  createPrismaClient,
  type ApiPrismaClient,
} from "../src/infrastructure/prisma.js";
import { getDisposableTestDatabaseUrl } from "./support/test-database.js";

const execFileAsync = promisify(execFile);
const testDatabaseUrl = getDisposableTestDatabaseUrl(process.env);
const disposableTestDatabaseUrl = testDatabaseUrl ?? "";
const runMariaDbTests = Boolean(testDatabaseUrl);

function bootstrapEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: disposableTestDatabaseUrl,
    NODE_ENV: "test",
    WZ_ADMIN_BOOTSTRAP_EMAIL: ADMINISTRATOR.email,
    WZ_ADMIN_BOOTSTRAP_PASSWORD: ADMINISTRATOR.password,
    WZ_ADMIN_BOOTSTRAP_DISPLAY_NAME: ADMINISTRATOR.displayName,
    ...overrides,
  };
}

describe.runIf(runMariaDbTests)("administrator bootstrap (MariaDB)", () => {
  let prisma: ApiPrismaClient;

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
    await clearAdministratorFixtures(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it("creates one administrator and updates it idempotently without exposing hashes", async () => {
    const first = await bootstrapAdministrator(bootstrapEnvironment());
    expect(first.exitCode).toBe(0);
    expect(first.output).not.toContain(ADMINISTRATOR.password);
    expect(first.output).not.toContain("$argon2id$");

    const created = await prisma.adminUser.findUniqueOrThrow({
      where: { email: ADMINISTRATOR.email },
    });
    expect(created).toMatchObject({
      email: ADMINISTRATOR.email,
      displayName: ADMINISTRATOR.displayName,
    });
    expect(created.passwordHash).toMatch(/^\$argon2id\$/);
    expect(created.passwordHash).not.toContain(ADMINISTRATOR.password);

    const updatedPassword = "Another-Correct-Horse-8!";
    const updatedDisplayName = "Administratrice mise à jour";
    const second = await bootstrapAdministrator(
      bootstrapEnvironment({
        WZ_ADMIN_BOOTSTRAP_PASSWORD: updatedPassword,
        WZ_ADMIN_BOOTSTRAP_DISPLAY_NAME: updatedDisplayName,
      }),
    );
    expect(second.exitCode).toBe(0);
    expect(second.output).not.toContain(updatedPassword);
    expect(second.output).not.toContain("$argon2id$");

    const administrators = await prisma.adminUser.findMany({
      where: { email: ADMINISTRATOR.email },
    });
    expect(administrators).toHaveLength(1);
    expect(administrators[0]).toMatchObject({
      email: ADMINISTRATOR.email,
      displayName: updatedDisplayName,
    });
    expect(administrators[0]?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(administrators[0]?.passwordHash).not.toBe(created.passwordHash);
    expect(administrators[0]?.passwordHash).not.toContain(updatedPassword);
  });

  it("refuses missing or weak bootstrap credentials without writing or logging secrets", async () => {
    const weakPassword = "weak";
    const weak = await bootstrapAdministrator(
      bootstrapEnvironment({ WZ_ADMIN_BOOTSTRAP_PASSWORD: weakPassword }),
    );
    expect(weak.exitCode).not.toBe(0);
    expect(weak.output).not.toContain(weakPassword);
    expect(weak.output).not.toContain("$argon2id$");

    const missingPassword = await bootstrapAdministrator(
      bootstrapEnvironment({ WZ_ADMIN_BOOTSTRAP_PASSWORD: undefined }),
    );
    expect(missingPassword.exitCode).not.toBe(0);
    expect(missingPassword.output).not.toContain("$argon2id$");

    await expect(prisma.adminUser.count()).resolves.toBe(0);
  });
});
