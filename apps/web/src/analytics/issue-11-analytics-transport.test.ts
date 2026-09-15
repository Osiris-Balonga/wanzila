import { describe, expect, it, vi } from "vitest";

const SESSION_KEY = "wanzila.analytics.session.v1";
const analyticsTransportModule = "./transport.js";
const EVENT = {
  schemaVersion: 1 as const,
  name: "search_submitted" as const,
  properties: { queryLength: 12 },
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

class SessionStorageStub implements SessionStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

type TransportOptions = {
  endpoint: string;
  sessionStorage?: SessionStorageLike | undefined;
  navigator?: { sendBeacon?: (url: string, data: Blob) => boolean };
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
};

type AnalyticsTransport = {
  sessionId: () => string;
  track: (event: typeof EVENT) => void;
};

type AnalyticsTransportFactory = (
  options: TransportOptions,
) => AnalyticsTransport;

type FetchRequest = { input: string; init: RequestInit };
type BeaconRequest = { url: string; data: Blob };
type BrowserEnvelope = typeof EVENT & { sessionId: string };

function isTransportFactory(
  candidate: unknown,
): candidate is { createAnalyticsTransport: AnalyticsTransportFactory } {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "createAnalyticsTransport" in candidate &&
    typeof candidate.createAnalyticsTransport === "function"
  );
}

async function loadTransport(): Promise<AnalyticsTransportFactory> {
  const candidate: unknown = await import(
    /* @vite-ignore */ analyticsTransportModule
  );
  if (!isTransportFactory(candidate)) {
    throw new Error("Analytics browser transport is unavailable.");
  }
  return candidate.createAnalyticsTransport;
}

function strictObject(value: unknown, allowedKeys: readonly string[]) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== allowedKeys.length ||
    Object.keys(record).some((key) => !allowedKeys.includes(key))
  ) {
    throw new Error("Expected no unknown JSON keys.");
  }
  return record;
}

function parseBrowserEnvelope(value: unknown): BrowserEnvelope {
  const envelope = strictObject(value, [
    "schemaVersion",
    "name",
    "sessionId",
    "properties",
  ]);
  const properties = strictObject(envelope.properties, ["queryLength"]);
  if (
    envelope.schemaVersion !== 1 ||
    envelope.name !== "search_submitted" ||
    typeof envelope.sessionId !== "string" ||
    !uuidPattern.test(envelope.sessionId) ||
    properties.queryLength !== 12
  ) {
    throw new Error("Invalid analytics browser event envelope.");
  }
  return {
    schemaVersion: 1,
    name: "search_submitted",
    sessionId: envelope.sessionId,
    properties: { queryLength: 12 },
  };
}

function expectSerializedEnvelope(serialized: string, sessionId: string): void {
  expect(parseBrowserEnvelope(JSON.parse(serialized))).toEqual({
    ...EVENT,
    sessionId,
  });
}

async function expectBeaconRequest(
  request: BeaconRequest | undefined,
  sessionId: string,
): Promise<void> {
  if (!request) {
    throw new Error("Expected a beacon request.");
  }
  expect(request.url).toBe("/api/v1/analytics/events");
  expect(request.data.type).toBe("application/json");
  expectSerializedEnvelope(await request.data.text(), sessionId);
}

function expectFetchRequest(
  request: FetchRequest | undefined,
  sessionId: string,
): void {
  if (!request) {
    throw new Error("Expected a fetch request.");
  }
  expect(request.input).toBe("/api/v1/analytics/events");
  expect(request.init.method).toBe("POST");
  expect(request.init.keepalive).toBe(true);
  expect(new Headers(request.init.headers).get("content-type")).toBe(
    "application/json",
  );
  if (typeof request.init.body !== "string") {
    throw new Error("Expected fetch to send a JSON string body.");
  }
  expectSerializedEnvelope(request.init.body, sessionId);
}

describe("issue #11 browser analytics transport", () => {
  it("creates one anonymous UUID per tab session and regenerates it for a new session", async () => {
    const createAnalyticsTransport = await loadTransport();
    const firstTab = new SessionStorageStub();
    const firstTransport = createAnalyticsTransport({
      endpoint: "/api/v1/analytics/events",
      sessionStorage: firstTab,
    });
    const sameTabTransport = createAnalyticsTransport({
      endpoint: "/api/v1/analytics/events",
      sessionStorage: firstTab,
    });
    const newTabTransport = createAnalyticsTransport({
      endpoint: "/api/v1/analytics/events",
      sessionStorage: new SessionStorageStub(),
    });

    const firstSessionId = firstTransport.sessionId();
    expect(firstSessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(firstTab.getItem(SESSION_KEY)).toBe(firstSessionId);
    expect(sameTabTransport.sessionId()).toBe(firstSessionId);
    expect(newTabTransport.sessionId()).not.toBe(firstSessionId);
  });

  it("serializes the generated session and event through sendBeacon", async () => {
    const createAnalyticsTransport = await loadTransport();
    let beaconRequest: BeaconRequest | undefined;
    const sendBeacon = vi.fn((url: string, data: Blob) => {
      beaconRequest = { url, data };
      return true;
    });
    const fetch =
      vi.fn<(input: string, init: RequestInit) => Promise<Response>>();
    const transport = createAnalyticsTransport({
      endpoint: "/api/v1/analytics/events",
      sessionStorage: new SessionStorageStub(),
      navigator: { sendBeacon },
      fetch,
    });

    const sessionId = transport.sessionId();
    expect(() => transport.track(EVENT)).not.toThrow();
    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    await expectBeaconRequest(beaconRequest, sessionId);
  });

  it.each([
    { label: "is unavailable", navigator: {} },
    {
      label: "returns false",
      navigator: { sendBeacon: vi.fn(() => false) },
    },
  ])(
    "falls back to keepalive fetch when sendBeacon $label",
    async ({ navigator }) => {
      const createAnalyticsTransport = await loadTransport();
      let fetchRequest: FetchRequest | undefined;
      const fetch = vi.fn((input: string, init: RequestInit) => {
        fetchRequest = { input, init };
        return Promise.resolve(new Response(null, { status: 202 }));
      });
      const transport = createAnalyticsTransport({
        endpoint: "/api/v1/analytics/events",
        sessionStorage: new SessionStorageStub(),
        navigator,
        fetch,
      });

      const sessionId = transport.sessionId();
      expect(() => transport.track(EVENT)).not.toThrow();
      expect(fetch).toHaveBeenCalledOnce();
      expectFetchRequest(fetchRequest, sessionId);
    },
  );

  it.each([
    { label: "is unavailable", sessionStorage: undefined },
    {
      label: "throws during access",
      sessionStorage: {
        getItem: () => {
          throw new Error("storage unavailable");
        },
        setItem: () => {
          throw new Error("storage unavailable");
        },
      } satisfies SessionStorageLike,
    },
  ])(
    "does not block a public action when sessionStorage $label",
    async ({ sessionStorage }) => {
      const createAnalyticsTransport = await loadTransport();
      const fetch = vi.fn(() =>
        Promise.resolve(new Response(null, { status: 202 })),
      );
      const action = vi.fn();
      const transport = createAnalyticsTransport({
        endpoint: "/api/v1/analytics/events",
        sessionStorage,
        navigator: {},
        fetch,
      });

      expect(() => {
        transport.track(EVENT);
        action();
      }).not.toThrow();
      expect(action).toHaveBeenCalledOnce();
      expect(transport.sessionId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    },
  );

  it.each([
    {
      label: "a rejected fetch",
      navigator: {},
      fetch: vi.fn(() => Promise.reject(new Error("network unavailable"))),
    },
    {
      label: "a synchronous sendBeacon failure",
      navigator: {
        sendBeacon: vi.fn(() => {
          throw new Error("beacon unavailable");
        }),
      },
      fetch: vi.fn(() => Promise.reject(new Error("network unavailable"))),
    },
  ])(
    "never propagates $label into search, call, route, or arrival actions",
    async ({ navigator, fetch }) => {
      const createAnalyticsTransport = await loadTransport();
      const transport = createAnalyticsTransport({
        endpoint: "/api/v1/analytics/events",
        sessionStorage: new SessionStorageStub(),
        navigator,
        fetch,
      });
      const actions = {
        arrival: vi.fn(),
        call: vi.fn(),
        route: vi.fn(),
        search: vi.fn(),
      };

      for (const action of Object.values(actions)) {
        expect(() => {
          transport.track(EVENT);
          action();
        }).not.toThrow();
      }

      for (const action of Object.values(actions)) {
        expect(action).toHaveBeenCalledOnce();
      }
    },
  );
});
