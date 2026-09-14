# Architecture

Wanzila is a mobile-first web application with two presentation surfaces and one backend:

```text
Public and administration web UI
                |
             HTTP API
                |
        Fastify application
                |
              Prisma
                |
        Managed MySQL database
```

The public interface and administration interface are routes within the same web application. They share visual foundations and API contracts but keep separate navigation shells.

## Boundaries

- `apps/web` owns rendering, interaction, responsive behavior, and browser integrations.
- `apps/api` owns authentication, authorization, validation, orchestration, and persistence access.
- `packages/domain` owns deterministic business rules with no framework imports.
- `packages/contracts` owns API schemas and inferred TypeScript types.
- Prisma is only imported by the API.

## Constraints

- Public visitors do not need an account.
- Administrative writes require authentication.
- Duty periods and regular opening hours are distinct concepts.
- All timestamps are stored in UTC and rendered in the product timezone.
- User location is never retained as a personal journey history.
- The UI must expose source freshness instead of implying guaranteed availability.

Architecture changes that cross these boundaries require a short decision record in this directory.
