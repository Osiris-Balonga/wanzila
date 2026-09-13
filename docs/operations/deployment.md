# Deployment

Production is deployed to Hostinger from the protected `main` branch through Hostinger's GitHub integration.

## Release flow

```text
feature branch -> pull request -> dev -> release pull request -> main -> Hostinger build
```

Only `dev` may target `main`. CI must pass before merge. Hostinger then builds the repository and starts the Node.js API, which serves the compiled web application.

Expected production settings:

- package manager: pnpm
- Node.js: 24
- build command: `pnpm install --frozen-lockfile && pnpm build`
- entry file: `apps/api/dist/main.js`
- health endpoint: `/api/v1/health`

Required secrets are configured in Hostinger, never committed:

- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV=production`
- `SERVE_WEB=true`

Database migrations run as an explicit release step before application traffic depends on the new schema. They are never executed from browser code.

Feature pull requests are squash-merged into `dev`. Promotion pull requests are merged from `dev` into `main` with a merge commit, preserving clean branch ancestry for the next release.
