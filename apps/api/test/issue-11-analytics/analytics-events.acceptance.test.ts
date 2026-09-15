import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { ApiPrismaClient } from "../../src/infrastructure/prisma.js";
import { getDisposableTestDatabaseUrl } from "../support/test-database.js";

const execFileAsync = promisify(execFile);
const testDatabaseUrl = getDisposableTestDatabaseUrl(process.env);
const runMariaDbTests = Boolean(testDatabaseUrl);
const disposableTestDatabaseUrl = testDatabaseUrl ?? "";
const workspaceRoot = resolve(import.meta.dirname, "../../../..");

const NOW = new Date("2026-09-15T12:00:00.000Z");
const SESSION_ID = "00000000-0000-4000-8000-000000001111";
const PHARMACY_ID = "00000000-0000-4000-8000-000000002222";
const ANALYTICS_PATH = "/api/v1/analytics/events";
const ANALYTICS_BODY_LIMIT_BYTES = 16 * 1024;
const ANALYTICS_RATE_LIMIT = 2;

type AnalyticsEventName =
  | "discovery_viewed"
  | "search_submitted"
  | "filters_applied"
  | "empty_results_shown"
  | "pharmacy_detail_viewed"
  | "pharmacy_call_started"
  | "route_started"
  | "arrival_confirmed"
  | "discovery_failed";

type AnalyticsEnvelope = {
  schemaVersion: 1;
  name: AnalyticsEventName;
  sessionId: string;
  properties: Record<string, unknown>;
};

type StoredEvent = {
  name: string;
  sessionId: string;
  properties: Record<string, unknown>;
  occurredAt: Date;
};

function event(
  name: AnalyticsEventName,
  properties: Record<string, unknown>,
): AnalyticsEnvelope {
  return {
    schemaVersion: 1,
    name,
    sessionId: SESSION_ID,
    properties,
  };
}

const validEvents: readonly AnalyticsEnvelope[] = [
  event("discovery_viewed", {}),
  event("search_submitted", { queryLength: 12 }),
  event("filters_applied", {
    district: "Plateau",
    arrondissement: "Poto-Poto",
  }),
  event("empty_results_shown", { queryLength: 12, resultCount: 0 }),
  event("pharmacy_detail_viewed", { pharmacyId: PHARMACY_ID }),
  event("pharmacy_call_started", { pharmacyId: PHARMACY_ID }),
  event("route_started", { pharmacyId: PHARMACY_ID }),
  event("arrival_confirmed", { pharmacyId: PHARMACY_ID }),
  event("discovery_failed", { code: "NETWORK_ERROR" }),
];

class AnalyticsPrismaStub {
  readonly stored: StoredEvent[] = [];
  readonly cleanupCalls: unknown[] = [];

  readonly analyticsEvent = {
    create: (argument: unknown) => {
      const data = (argument as { data: StoredEvent }).data;
      this.stored.push(data);
      return Promise.resolve(data);
    },
    deleteMany: (argument: unknown) => {
      this.cleanupCalls.push(argument);
      const cutoff = (argument as { where?: { occurredAt?: { lt?: Date } } })
        .where?.occurredAt?.lt;
      if (cutoff) {
        const retained = this.stored.filter(
          (storedEvent) => storedEvent.occurredAt >= cutoff,
        );
        const count = this.stored.length - retained.length;
        this.stored.splice(0, this.stored.length, ...retained);
        return Promise.resolve({ count });
      }
      return Promise.resolve({ count: 0 });
    },
  };

  async $disconnect(): Promise<void> {}

  asPrisma(): ApiPrismaClient {
    return this as unknown as ApiPrismaClient;
  }
}

describe("issue #11 analytics event ingestion contract", () => {
  const applications: Awaited<ReturnType<typeof createApp>>[] = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((app) => app.close()));
  });

  async function createAnalyticsApp(options?: { rateLimitMax?: number }) {
    const prisma = new AnalyticsPrismaStub();
    const app = await createApp({
      webOrigin: "http://localhost:5173",
      now: () => NOW,
      prisma: prisma.asPrisma(),
      rateLimitMax: options?.rateLimitMax ?? 120,
    });
    applications.push(app);
    return { app, prisma };
  }

  it.each(validEvents)(
    "accepts and normalizes the versioned %s event",
    async (payload) => {
      const { app, prisma } = await createAnalyticsApp();

      const response = await app.inject({
        method: "POST",
        url: ANALYTICS_PATH,
        payload,
      });

      expect(response.statusCode).toBe(202);
      expect(prisma.stored).toEqual([
        {
          name: payload.name,
          sessionId: SESSION_ID,
          properties: payload.properties,
          occurredAt: NOW,
        },
      ]);
    },
  );

  it.each([
    {
      label: "an unknown event name",
      payload: { ...event("discovery_viewed", {}), name: "profile_created" },
    },
    {
      label: "an unknown envelope key",
      payload: { ...event("discovery_viewed", {}), userId: "not-allowed" },
    },
    {
      label: "an unknown event property",
      payload: event("discovery_viewed", { referrer: "https://example.test" }),
    },
    {
      label: "raw search text",
      payload: event("search_submitted", {
        queryLength: 12,
        query: "paracetamol for a named person",
      }),
    },
    {
      label: "exact coordinates",
      payload: event("route_started", {
        pharmacyId: PHARMACY_ID,
        latitude: -4.263708,
        longitude: 15.242885,
      }),
    },
    {
      label: "a route trace",
      payload: event("route_started", {
        pharmacyId: PHARMACY_ID,
        routePoints: [
          { latitude: -4.263708, longitude: 15.242885 },
          { latitude: -4.2637, longitude: 15.2428 },
        ],
      }),
    },
    {
      label: "an oversized administrative filter",
      payload: event("filters_applied", { district: "x".repeat(121) }),
    },
    {
      label: "an invalid anonymous session identifier",
      payload: { ...event("discovery_viewed", {}), sessionId: "visitor-123" },
    },
    {
      label: "a search property combination for a pharmacy action",
      payload: event("pharmacy_call_started", { queryLength: 12 }),
    },
    {
      label: "a non-empty result count for an empty-results event",
      payload: event("empty_results_shown", {
        queryLength: 12,
        resultCount: 1,
      }),
    },
    {
      label: "an empty filter selection",
      payload: event("filters_applied", {}),
    },
  ])("rejects $label deterministically", async ({ payload }) => {
    const { app, prisma } = await createAnalyticsApp();

    const response = await app.inject({
      method: "POST",
      url: ANALYTICS_PATH,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "BAD_REQUEST", message: "Invalid analytics event" },
    });
    expect(prisma.stored).toEqual([]);
  });

  it("returns a stable 413 envelope before persisting an oversized body", async () => {
    const { app, prisma } = await createAnalyticsApp();
    const oversizedBody = JSON.stringify({
      ...event("discovery_viewed", {}),
      padding: "x".repeat(ANALYTICS_BODY_LIMIT_BYTES),
    });

    const response = await app.inject({
      method: "POST",
      url: ANALYTICS_PATH,
      headers: { "content-type": "application/json" },
      payload: oversizedBody,
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Analytics payload too large",
      },
    });
    expect(prisma.stored).toEqual([]);
  });

  it("returns a stable 429 envelope after the endpoint limit", async () => {
    const { app, prisma } = await createAnalyticsApp({
      rateLimitMax: ANALYTICS_RATE_LIMIT,
    });

    for (let attempt = 0; attempt < ANALYTICS_RATE_LIMIT; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: ANALYTICS_PATH,
        payload: event("discovery_viewed", {}),
      });
      expect(response.statusCode).toBe(202);
    }

    const limited = await app.inject({
      method: "POST",
      url: ANALYTICS_PATH,
      payload: event("discovery_viewed", {}),
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Too many analytics events" },
    });
    expect(prisma.stored).toHaveLength(ANALYTICS_RATE_LIMIT);
  });

  it("cleans records older than 30 days with an injected clock and remains idempotent", async () => {
    const { app, prisma } = await createAnalyticsApp();
    prisma.stored.push(
      {
        name: "discovery_viewed",
        sessionId: SESSION_ID,
        properties: {},
        occurredAt: new Date("2026-08-16T11:59:59.999Z"),
      },
      {
        name: "discovery_viewed",
        sessionId: SESSION_ID,
        properties: {},
        occurredAt: new Date("2026-08-16T12:00:00.000Z"),
      },
    );

    const first = await app.inject({
      method: "POST",
      url: ANALYTICS_PATH,
      payload: event("discovery_viewed", {}),
    });
    const second = await app.inject({
      method: "POST",
      url: ANALYTICS_PATH,
      payload: event("discovery_viewed", {}),
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(prisma.cleanupCalls).toEqual([
      { where: { occurredAt: { lt: new Date("2026-08-16T12:00:00.000Z") } } },
      { where: { occurredAt: { lt: new Date("2026-08-16T12:00:00.000Z") } } },
    ]);
    expect(prisma.stored).toEqual([
      {
        name: "discovery_viewed",
        sessionId: SESSION_ID,
        properties: {},
        occurredAt: new Date("2026-08-16T12:00:00.000Z"),
      },
      {
        name: "discovery_viewed",
        sessionId: SESSION_ID,
        properties: {},
        occurredAt: NOW,
      },
      {
        name: "discovery_viewed",
        sessionId: SESSION_ID,
        properties: {},
        occurredAt: NOW,
      },
    ]);
  });
});

describe.runIf(runMariaDbTests)(
  "issue #11 analytics persistence (MariaDB)",
  () => {
    let prisma: ApiPrismaClient;
    let app: Awaited<ReturnType<typeof createApp>>;

    beforeAll(async () => {
      const command = "pnpm --filter @wanzila/api db:migrate";
      await execFileAsync(
        process.platform === "win32" ? "cmd.exe" : "sh",
        process.platform === "win32"
          ? ["/d", "/s", "/c", command]
          : ["-c", command],
        {
          cwd: workspaceRoot,
          env: { ...process.env, DATABASE_URL: disposableTestDatabaseUrl },
        },
      );
    }, 60_000);

    beforeEach(async () => {
      const { createPrismaClient } =
        await import("../../src/infrastructure/prisma.js");
      prisma = createPrismaClient(disposableTestDatabaseUrl);
      await prisma.analyticsEvent.deleteMany();
      app = await createApp({
        webOrigin: "http://localhost:5173",
        now: () => NOW,
        prisma,
      });
    });

    afterEach(async () => {
      await app.close();
    });

    it("persists only normalized privacy-bounded data after a 202 response", async () => {
      const response = await app.inject({
        method: "POST",
        url: ANALYTICS_PATH,
        payload: event("route_started", { pharmacyId: PHARMACY_ID }),
      });

      expect(response.statusCode).toBe(202);
      const stored = await prisma.analyticsEvent.findFirstOrThrow({
        where: { name: "route_started" },
      });
      expect(stored).toMatchObject({
        name: "route_started",
        sessionId: SESSION_ID,
        pharmacyId: PHARMACY_ID,
        properties: { pharmacyId: PHARMACY_ID },
        occurredAt: NOW,
      });
      expect(JSON.stringify(stored)).not.toMatch(
        /latitude|longitude|routePoints/i,
      );
    });
  },
);
