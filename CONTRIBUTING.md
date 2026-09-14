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

## Shared-machine worktree isolation

Every concurrent task must use its own Git worktree outside the canonical repository directory. A branch alone is not isolation: switching branches in the shared checkout can overwrite another agent's working state.

The canonical repository is:

```text
C:\Users\Dell\Documents\Dev Projects\wanzila
```

Task worktrees belong under the sibling directory:

```text
C:\Users\Dell\Documents\Dev Projects\wanzila-worktrees\<issue>-<scope>
```

Create a new task worktree from the latest remote `dev`:

```powershell
git -C "C:\Users\Dell\Documents\Dev Projects\wanzila" fetch origin dev
git -C "C:\Users\Dell\Documents\Dev Projects\wanzila" worktree add -b feature/<area>/<scope> "C:\Users\Dell\Documents\Dev Projects\wanzila-worktrees\<issue>-<scope>" origin/dev
```

Before editing, verify both the isolated root and branch:

```powershell
git rev-parse --show-toplevel
git status --short --branch
```

- Run every install, edit, test, commit, and push command from the task worktree.
- Never run `git switch`, `git checkout`, `git stash`, `git reset`, or cleanup commands in the canonical repository while another task may be active.
- Never reuse another task's worktree or edit its files.
- A branch can be checked out in only one worktree. Continue follow-up work in its existing worktree instead of creating a duplicate.
- Each worktree installs its own `node_modules`; pnpm may reuse its global content-addressed store.
- Do not remove a worktree until its pull request is merged or the lead explicitly abandons it. The lead owns final worktree and branch cleanup.

## Development workflow

1. Select an assigned GitHub Issue and confirm its dependencies are complete.
2. Create a dedicated external worktree and branch from the latest `origin/dev` using an allowed prefix.
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
