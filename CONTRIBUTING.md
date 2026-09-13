# Contributing

All implementation work starts from `dev` and is delivered through short-lived branches.

## Branch policy

```text
main
└── dev
    ├── feature/web/<scope>
    ├── feature/api/<scope>
    ├── feature/data/<scope>
    ├── fix/<scope>
    ├── test/<scope>
    └── docs/<scope>
```

- Never push directly to `main` or `dev`.
- Only `dev` may open a pull request into `main`.
- Feature, fix, test, and documentation branches target `dev`.
- Create branches from the latest `dev`.
- Keep one coherent GitHub Issue per branch and pull request.
- Squash feature, fix, test, and documentation pull requests into `dev`.
- Merge `dev` promotion pull requests into `main` with a merge commit so the integration branch remains an ancestor of production.
- Delete merged branches.

GitHub Actions enforce the base/head relationship. Pull requests targeting `main` from any branch other than `dev` fail immediately.

## Development workflow

1. Select an assigned GitHub Issue and confirm its dependencies are complete.
2. Branch from `dev` using an allowed prefix.
3. Add or update tests for observable behavior; purely visual work uses screenshots and browser checks.
4. Run `pnpm validate`.
5. Open a pull request into `dev` and link the issue with `Closes #<number>`.
6. Wait for CI and review before merging.

Do not mix opportunistic refactors with feature work. Never commit credentials, generated Prisma Client files, build output, local editor configuration, or automation-specific instruction files.

## Verification boundaries

- Domain rules: focused Vitest tests.
- API behavior and persistence: integration tests against MySQL/MariaDB.
- Responsive UI behavior: component tests where useful and Playwright for critical journeys.
- Accessibility: keyboard checks, semantic assertions, and automated browser scanning.
- Database changes: Prisma migration plus a clean-database CI application.

No enabled test suite may pass because it contains zero tests.
