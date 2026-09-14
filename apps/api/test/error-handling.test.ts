import { apiErrorSchema, healthResponseSchema } from "@wanzila/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("public error handling", () => {
  const applications: Awaited<ReturnType<typeof createApp>>[] = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((app) => app.close()));
  });

  it("preserves Fastify rate-limit status in the public envelope", async () => {
    const app = await createApp({
      webOrigin: "http://localhost:5173",
      rateLimitMax: 1,
    });
    applications.push(app);

    const first = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(healthResponseSchema.parse(first.json())).toEqual({
      status: "ok",
      service: "wanzila-api",
    });

    const limited = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(limited.statusCode).toBe(429);
    expect(apiErrorSchema.parse(limited.json())).toEqual({
      error: { code: "RATE_LIMITED", message: "Too many requests" },
    });
  });

  it("preserves other known Fastify 4xx statuses", async () => {
    const app = await createApp({ webOrigin: "http://localhost:5173" });
    applications.push(app);
    app.get("/api/v1/test-client-error", () => {
      const error = new Error("Test client error");
      Object.assign(error, { statusCode: 418 });
      throw error;
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/test-client-error",
    });
    expect(response.statusCode).toBe(418);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: { code: "CLIENT_ERROR", message: "Request rejected" },
    });
  });
});
