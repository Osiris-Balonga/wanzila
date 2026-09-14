# Deployment

Production is deployed to Render from the protected `main` branch through Render's GitHub integration.

- public URL: <https://wanzila.onrender.com>
- Render service: `wanzila`
- region: Frankfurt
- plan: Free

## Release flow

```text
feature branch -> pull request -> dev -> release pull request -> main -> Render build
```

Only `dev` may target `main`. CI must pass before merge. Render then builds the repository and starts the Node.js API, which serves the compiled web application. Auto-deploy is enabled only for `main`; feature branches and `dev` do not deploy production.

The Render GitHub App is installed with repository access limited to `Osiris-Balonga/wanzila`.

Production settings:

- package manager: pnpm
- Node.js: 24
- build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- start command: `node apps/api/dist/main.js`
- entry file: `apps/api/dist/main.js`
- health endpoint: `/api/v1/health`
- environment: `API_PORT=10000`, `NODE_ENV=production`, `SERVE_WEB=true`

Database and session secrets will be configured in Render, never committed:

- `DATABASE_URL`
- `SESSION_SECRET`

The application shell currently deploys without a database connection. `DATABASE_URL` will be added when the managed MySQL service is provisioned.

Database migrations run as an explicit release step before application traffic depends on the new schema. They are never executed from browser code.

Feature pull requests are squash-merged into `dev`. Promotion pull requests are merged from `dev` into `main` with a merge commit, preserving clean branch ancestry for the next release.

Render keeps the two most recent successful deploys available for rollback from the service dashboard. The Free service can sleep after inactivity, so the first request after an idle period may take longer.
