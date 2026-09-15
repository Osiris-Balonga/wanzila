import { analyticsBadRequestResponseSchema } from "@wanzila/contracts";
import { expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { ApiPrismaClient } from "../src/infrastructure/prisma.js";

it("returns the stable analytics 400 envelope for syntactically invalid JSON", async () => {
  const prisma = {
    $disconnect: async () => {},
    analyticsEvent: {
      create: () =>
        Promise.reject(new Error("Invalid JSON must not reach persistence.")),
    },
  } as unknown as ApiPrismaClient;
  const app = await createApp({
    webOrigin: "http://localhost:5173",
    prisma,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events",
      headers: { "content-type": "application/json" },
      payload: '{"schemaVersion":',
    });

    expect(response.statusCode).toBe(400);
    expect(analyticsBadRequestResponseSchema.parse(response.json())).toEqual({
      error: { code: "BAD_REQUEST", message: "Invalid analytics event" },
    });
  } finally {
    await app.close();
  }
});
