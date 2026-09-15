import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiPrismaClient } from "../../src/infrastructure/prisma.js";

const execFileAsync = promisify(execFile);

export const ADMINISTRATOR = {
  email: "administrator.auth@wanzila.test",
  displayName: "Administratrice Wanzila",
  password: "Correct-Horse-Battery-7!",
} as const;

export const WEB_ORIGIN = "http://localhost:5173";
export const workspaceRoot = resolve(import.meta.dirname, "../../..");

interface CommandResult {
  exitCode: number;
  output: string;
}

function shellCommand(command: string): { file: string; args: string[] } {
  return process.platform === "win32"
    ? { file: "cmd.exe", args: ["/d", "/s", "/c", command] }
    : { file: "sh", args: ["-c", command] };
}

/** Invokes the externally supported, environment-driven administrator bootstrap. */
export async function bootstrapAdministrator(
  environment: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  const command = "pnpm --filter @wanzila/api admin:bootstrap";
  const shell = shellCommand(command);

  try {
    const result = await execFileAsync(shell.file, shell.args, {
      cwd: workspaceRoot,
      env: environment,
    });
    return { exitCode: 0, output: `${result.stdout}${result.stderr}` };
  } catch (error) {
    const commandError = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      exitCode: commandError.code ?? 1,
      output: `${commandError.stdout ?? ""}${commandError.stderr ?? ""}`,
    };
  }
}

export async function clearAdministratorFixtures(
  prisma: ApiPrismaClient,
): Promise<void> {
  const sessionTable = await prisma.$queryRawUnsafe<
    Array<{ tableName: string }>
  >("SHOW TABLES LIKE 'AdminSession'");
  if (sessionTable.length > 0) {
    await prisma.$executeRawUnsafe("DELETE FROM AdminSession");
  }
  await prisma.adminUser.deleteMany();
}

type AdministratorAuthorizationPreHandler = (
  request: FastifyRequest,
) => void | Promise<void>;

interface AdministratorAuthorizationModule {
  createAdministratorAuthorizationPreHandler(options: {
    prisma: ApiPrismaClient;
    now: () => Date;
  }): AdministratorAuthorizationPreHandler;
}

/**
 * A test-only route proves that the production authorization pre-handler can
 * protect a separate administration module without duplicating auth logic.
 */
export async function registerProtectedAdministratorTestRoute(
  app: FastifyInstance,
  prisma: ApiPrismaClient,
  now: () => Date,
): Promise<void> {
  const authorizationModulePath = [
    "..",
    "..",
    "src",
    "modules",
    "admin-auth",
    "authorization.js",
  ].join("/");
  const authorization = (await import(
    authorizationModulePath
  )) as AdministratorAuthorizationModule;
  const preHandler = authorization.createAdministratorAuthorizationPreHandler({
    prisma,
    now,
  });

  app.get("/api/v1/admin/test-only/protected", { preHandler }, () => ({
    data: { scope: "administrator" as const },
  }));
}
