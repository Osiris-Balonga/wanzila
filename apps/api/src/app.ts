import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import fastify from "fastify";
import type { HealthResponse } from "@wanzila/contracts";

export interface AppOptions {
  webOrigin: string;
  webRoot?: string;
  logger?: boolean;
}

export async function createApp(options: AppOptions) {
  const app = fastify({ logger: options.logger ?? false });

  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(cors, {
    origin: options.webOrigin,
    credentials: true,
  });

  app.get<{ Reply: HealthResponse }>("/api/v1/health", () => ({
    status: "ok",
    service: "wanzila-api",
  }));

  if (options.webRoot) {
    await app.register(staticFiles, { root: options.webRoot, wildcard: false });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ message: "Route not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
