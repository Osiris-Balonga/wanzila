import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import fastify from "fastify";
import type { HealthResponse } from "@wanzila/contracts";
import {
  createPrismaClient,
  type ApiPrismaClient,
} from "./infrastructure/prisma.js";
import { registerEmergencyContactRoutes } from "./modules/public-api/emergency-contact-routes.js";
import { registerPublicPharmacyRoutes } from "./modules/public-api/routes.js";
import { registerAdministratorAuthRoutes } from "./modules/admin-auth/routes.js";
import {
  internalError,
  sendClientError,
  sendNotFound,
} from "./modules/shared/http-errors.js";

const DEFAULT_SOURCE_FRESHNESS_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function isKnownClientError(error: unknown): error is { statusCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

export interface AppOptions {
  webOrigin: string;
  webRoot?: string;
  logger?: boolean;
  databaseUrl?: string;
  prisma?: ApiPrismaClient;
  now?: () => Date;
  sourceFreshnessMaxAgeMs?: number;
  rateLimitMax?: number;
  nodeEnvironment?: "development" | "test" | "production";
}

export async function createApp(options: AppOptions) {
  const app = fastify({ logger: options.logger ?? false });
  const prisma =
    options.prisma ??
    (options.databaseUrl ? createPrismaClient(options.databaseUrl) : undefined);
  const now = options.now ?? (() => new Date());
  const sourceFreshnessMaxAgeMs =
    options.sourceFreshnessMaxAgeMs ?? DEFAULT_SOURCE_FRESHNESS_MAX_AGE_MS;
  const rateLimitMax = options.rateLimitMax ?? 120;
  const nodeEnvironment = options.nodeEnvironment ?? "development";

  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { max: rateLimitMax, timeWindow: "1 minute" });
  await app.register(cors, {
    origin: options.webOrigin,
    credentials: true,
  });

  app.get<{ Reply: HealthResponse }>("/api/v1/health", () => ({
    status: "ok",
    service: "wanzila-api",
  }));

  registerAdministratorAuthRoutes(app, {
    prisma,
    now,
    webOrigin: options.webOrigin,
    nodeEnvironment,
  });

  if (prisma) {
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
    await app.register(
      (publicApi) => {
        registerPublicPharmacyRoutes(publicApi, {
          prisma,
          now,
          sourceFreshnessMaxAgeMs,
        });
        registerEmergencyContactRoutes(publicApi, prisma);
      },
      { prefix: "/api/v1" },
    );
  }

  app.setErrorHandler((error, request, reply) => {
    if (isKnownClientError(error)) {
      return sendClientError(reply, error.statusCode);
    }
    request.log.error(error);
    return reply.code(500).send(internalError());
  });

  if (options.webRoot) {
    await app.register(staticFiles, { root: options.webRoot, wildcard: false });
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/") || !options.webRoot) {
      return sendNotFound(reply);
    }
    return reply.sendFile("index.html");
  });

  return app;
}
