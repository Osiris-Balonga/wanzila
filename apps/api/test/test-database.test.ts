import { describe, expect, it } from "vitest";
import { getDisposableTestDatabaseUrl } from "./support/test-database.js";

describe("MariaDB integration database guard", () => {
  it("stays disabled without the explicit opt-in", () => {
    expect(
      getDisposableTestDatabaseUrl({
        WZ_TEST_DATABASE_URL: "mysql://user:password@localhost/wanzila_test",
      }),
    ).toBeUndefined();
  });

  it("accepts an explicitly named disposable test database", () => {
    expect(
      getDisposableTestDatabaseUrl({
        WZ_RUN_MARIADB_TESTS: "true",
        WZ_TEST_DATABASE_URL:
          "mysql://user:password@localhost/wanzila_issue4_test_ci",
      }),
    ).toBe("mysql://user:password@localhost/wanzila_issue4_test_ci");
  });

  it("rejects ambiguous targets and the ordinary DATABASE_URL", () => {
    expect(() =>
      getDisposableTestDatabaseUrl({
        WZ_RUN_MARIADB_TESTS: "true",
        WZ_TEST_DATABASE_URL: "mysql://user:password@localhost/wanzila",
      }),
    ).toThrow(/disposable database/);

    expect(() =>
      getDisposableTestDatabaseUrl({
        WZ_RUN_MARIADB_TESTS: "true",
        WZ_TEST_DATABASE_URL: "mysql://user:password@localhost/wanzila_test_ci",
        DATABASE_URL: "mysql://different:password@localhost/wanzila_test_ci",
      }),
    ).toThrow(/must not target the ordinary DATABASE_URL database/);
  });
});
