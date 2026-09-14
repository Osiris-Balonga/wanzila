const disposableDatabaseName = /(^|_)test(?:_|$)/i;

function databaseIdentity(databaseUrl: URL): string {
  return [
    databaseUrl.protocol,
    databaseUrl.hostname.toLowerCase(),
    databaseUrl.port,
    databaseUrl.pathname,
  ].join("|");
}

function parseDatabaseUrl(value: string, variableName: string): URL {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid database URL.`);
  }

  if (databaseUrl.protocol !== "mysql:") {
    throw new Error(`${variableName} must use the mysql protocol.`);
  }

  return databaseUrl;
}

function parseTestDatabaseUrl(value: string): URL {
  const databaseUrl = parseDatabaseUrl(value, "WZ_TEST_DATABASE_URL");

  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !disposableDatabaseName.test(databaseName)
  ) {
    throw new Error(
      "WZ_TEST_DATABASE_URL must target a disposable database with a _test_ name segment.",
    );
  }

  return databaseUrl;
}

/**
 * Enables destructive MariaDB integration setup only for an explicitly named,
 * disposable database. It intentionally rejects the ordinary DATABASE_URL.
 */
export function getDisposableTestDatabaseUrl(
  environment: NodeJS.ProcessEnv,
): string | undefined {
  if (environment.WZ_RUN_MARIADB_TESTS !== "true") {
    return undefined;
  }

  if (!environment.WZ_TEST_DATABASE_URL) {
    throw new Error(
      "WZ_TEST_DATABASE_URL is required when WZ_RUN_MARIADB_TESTS=true.",
    );
  }

  const testDatabaseUrl = parseTestDatabaseUrl(
    environment.WZ_TEST_DATABASE_URL,
  );
  if (environment.DATABASE_URL) {
    const normalDatabaseUrl = parseDatabaseUrl(
      environment.DATABASE_URL,
      "DATABASE_URL",
    );
    if (
      databaseIdentity(testDatabaseUrl) === databaseIdentity(normalDatabaseUrl)
    ) {
      throw new Error(
        "WZ_TEST_DATABASE_URL must not target the ordinary DATABASE_URL database.",
      );
    }
  }

  return testDatabaseUrl.toString();
}
