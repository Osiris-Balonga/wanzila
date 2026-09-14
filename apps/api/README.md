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
