# Database workflow

The API database uses UTC timestamps. `Africa/Brazzaville` is the sole product presentation timezone and is exposed by `@wanzila/domain` as `PRODUCT_TIME_ZONE`.

Create `apps/api/.env` from `.env.example` and point `DATABASE_URL` at a disposable local or test MariaDB database. The fixture uses only synthetic data, including the local-only `admin.fixture@local.test` administrator record; it is not an authentication credential.

Apply every migration, then load the deterministic fixtures:

```bash
pnpm db:migrate
pnpm db:seed
```

To recreate the same fixture data on a disposable database, reset it and seed it again:

```bash
pnpm db:reset
```

`db:reset` drops all data in the configured database. The seed uses stable IDs and fixed UTC timestamps, and is safe to run again after migrations without changing fixture values.

## Public API

All public discovery routes are mounted below `/api/v1` and use JSON responses:

- `GET /pharmacies?q=&district=&arrondissement=&page=&pageSize=` lists only published pharmacies with an approved, non-exceptional duty active at the request instant. Results are sorted by name then ID.
- `GET /pharmacies/:id` returns a published pharmacy; `currentDuty` is omitted when it has no active approved duty.
- `GET /emergency-contacts` returns only published contacts, sorted by `position` then ID.

`phone`, `currentDuty`, and `currentDuty.source` are omitted when the underlying value is absent. Duty timestamps are UTC ISO-8601 values. `sourceFreshness` is `FRESH`, `STALE`, or `UNKNOWN`; it describes the schedule data and never guarantees that a pharmacy is open.

Invalid query/path values return `400` with `{ "error": { "code": "BAD_REQUEST", ... } }`; a valid unknown pharmacy ID returns `404`. Unexpected failures use a stable `500` response without database details.

### MariaDB integration tests

The integration suite is deliberately opt-in so a normal local unit-test run never mutates a developer database. Point `WZ_TEST_DATABASE_URL` to a disposable MariaDB database and set `WZ_RUN_MARIADB_TESTS=true`; the suite applies Prisma migrations and replaces all relevant rows with controlled fixtures before each test:

```powershell
$env:WZ_TEST_DATABASE_URL = "mysql://user:password@127.0.0.1:3306/wanzila_test"
$env:WZ_RUN_MARIADB_TESTS = "true"
pnpm --filter @wanzila/api test:integration
```
