# Wanzila

Wanzila is the repository for Pharma Garde, a mobile-first web application that helps people find active on-duty pharmacies in Brazzaville and gives the product team a back office for schedules, data quality, contributions, reports, and analytics.

The repository is currently in its foundation phase. Product workflows and visual references are versioned under `docs/`; implementation work is tracked in GitHub Issues and must follow the branch policy described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture

- `apps/web`: responsive public experience and administration interface
- `apps/api`: Fastify HTTP API and Prisma migrations
- `packages/domain`: framework-independent business rules
- `packages/contracts`: shared request and response schemas
- `docs`: product, architecture, design, and operational references
- `tests/e2e`: critical browser journeys

The production application is deployed as one Node.js service on Render. The API serves the built web assets and will connect to a managed MySQL database through Prisma.

## Requirements

- Node.js 24.18
- pnpm 11.19 or newer within major 11
- MySQL 8 or a compatible MariaDB release

## Local development

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:generate
pnpm dev
```

The web application runs on `http://localhost:5173`; the API runs on `http://localhost:3000`.

## Validation

```bash
pnpm validate
pnpm test:e2e
```

CI additionally applies all Prisma migrations against a clean MariaDB database before accepting a pull request.

## Product references

- [Product workflows](docs/product/README.md)
- [Design inventory](docs/design/README.md)
- [Architecture decisions](docs/architecture/README.md)
- [Deployment](docs/operations/deployment.md)

## Status

This is a public demonstration project. It is not intended to provide medical advice or guarantee that a pharmacy is open. Source freshness and verification must always be visible to users.
