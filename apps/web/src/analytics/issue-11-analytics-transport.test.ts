import { describe, expect, it, vi } from "vitest";

const SESSION_KEY = "wanzila.analytics.session.v1";
const analyticsTransportModule = "./transport.js";
const PHARMACY_ID = "00000000-0000-4000-8000-000000002222";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BrowserEventName =
  | "discovery_viewed"
  | "search_submitted"
  | "filters_applied"
  | "empty_results_shown"
  | "pharmacy_detail_viewed"
  | "pharmacy_call_started"
  | "route_started"
  | "arrival_confirmed"
  | "discovery_failed";

type BrowserEvent = {
  schemaVersion: 1;
  name: BrowserEventName;
  properties: Record<string, unknown>;
};

const browserEvents: readonly BrowserEvent[] = [
  { schemaVersion: 1, name: "discovery_viewed", properties: {} },
  {
    schemaVersion: 1,
    name: "search_submitted",
    properties: { queryLength: 12 },
  },
  {
    schemaVersion: 1,
    name: "filters_applied",
    properties: { district: "Plateau", arrondissement: "Poto-Poto" },
  },
  {
    schemaVersion: 1,
    name: "empty_results_shown",
    properties: { queryLength: 12, resultCount: 0 },
  },
  {
    schemaVersion: 1,
    name: "pharmacy_detail_viewed",
    properties: { pharmacyId: PHARMACY_ID },
  },
  {
    schemaVersion: 1,
    name: "pharmacy_call_started",
    properties: { pharmacyId: PHARMACY_ID },
  },
  {
    schemaVersion: 1,
    name: "route_started",
    properties: { pharmacyId: PHARMACY_ID },
  },
  {
    schemaVersion: 1,
    name: "arrival_confirmed",
    properties: { pharmacyId: PHARMACY_ID },
  },
  {
    schemaVersion: 1,
    name: "discovery_failed",
    properties: { code: "NETWORK_ERROR" },
  },
];

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
  track: (event: BrowserEvent) => void;
};

type AnalyticsTransportFactory = (
  options: TransportOptions,
) => AnalyticsTransport;

type FetchRequest = { input: string; init: RequestInit };
type BeaconRequest = { url: string; data: Blob };
type BrowserEnvelope = BrowserEvent & { sessionId: string };

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

function parseBrowserEnvelope(
  value: unknown,
  expectedEvent: BrowserEvent,
): BrowserEnvelope {
  const envelope = strictObject(value, [
    "schemaVersion",
    "name",
    "sessionId",
    "properties",
  ]);
  const properties = strictObject(
    envelope.properties,
    Object.keys(expectedEvent.properties),
  );
  if (
    envelope.schemaVersion !== 1 ||
    envelope.name !== expectedEvent.name ||
    typeof envelope.sessionId !== "string" ||
    !uuidPattern.test(envelope.sessionId) ||
    JSON.stringify(properties) !== JSON.stringify(expectedEvent.properties)
  ) {
    throw new Error("Invalid analytics browser event envelope.");
  }
  return {
    ...expectedEvent,
    sessionId: envelope.sessionId,
  };
}

function expectSerializedEnvelope(
  serialized: string,
  expectedEvent: BrowserEvent,
  sessionId: string,
): void {
  expect(parseBrowserEnvelope(JSON.parse(serialized), expectedEvent)).toEqual({
    ...expectedEvent,
    sessionId,
  });
}

async function expectBeaconRequest(
  request: BeaconRequest | undefined,
  expectedEvent: BrowserEvent,
  sessionId: string,
): Promise<void> {
  if (!request) {
    throw new Error("Expected a beacon request.");
  }
  expect(request.url).toBe("/api/v1/analytics/events");
  expect(request.data.type).toBe("application/json");
  expectSerializedEnvelope(await request.data.text(), expectedEvent, sessionId);
}

function expectFetchRequest(
  request: FetchRequest | undefined,
  expectedEvent: BrowserEvent,
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
  expectSerializedEnvelope(request.init.body, expectedEvent, sessionId);
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
    expect(firstSessionId).toMatch(uuidPattern);
    expect(firstTab.getItem(SESSION_KEY)).toBe(firstSessionId);
    expect(sameTabTransport.sessionId()).toBe(firstSessionId);
    expect(newTabTransport.sessionId()).not.toBe(firstSessionId);
  });

  it.each(browserEvents)(
    "serializes the versioned $name event through sendBeacon",
    async (event) => {
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
      expect(() => transport.track(event)).not.toThrow();
      expect(sendBeacon).toHaveBeenCalledOnce();
      expect(fetch).not.toHaveBeenCalled();
      await expectBeaconRequest(beaconRequest, event, sessionId);
    },
  );

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
      const event = browserEvents[1];
      if (!event) {
        throw new Error("Missing browser test event.");
      }

      const sessionId = transport.sessionId();
      expect(() => transport.track(event)).not.toThrow();
      expect(fetch).toHaveBeenCalledOnce();
      expectFetchRequest(fetchRequest, event, sessionId);
    },
  );

  it("falls back to a validated keepalive fetch when sendBeacon throws", async () => {
    const createAnalyticsTransport = await loadTransport();
    let fetchRequest: FetchRequest | undefined;
    const fetch = vi.fn((input: string, init: RequestInit) => {
      fetchRequest = { input, init };
      return Promise.resolve(new Response(null, { status: 202 }));
    });
    const transport = createAnalyticsTransport({
      endpoint: "/api/v1/analytics/events",
      sessionStorage: new SessionStorageStub(),
      navigator: {
        sendBeacon: vi.fn(() => {
          throw new Error("beacon unavailable");
        }),
      },
      fetch,
    });
    const event = browserEvents[6];
    if (!event) {
      throw new Error("Missing browser test event.");
    }

    const sessionId = transport.sessionId();
    expect(() => transport.track(event)).not.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
    expectFetchRequest(fetchRequest, event, sessionId);
  });

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
      const event = browserEvents[0];
      if (!event) {
        throw new Error("Missing browser test event.");
      }

      expect(() => {
        transport.track(event);
        action();
      }).not.toThrow();
      expect(action).toHaveBeenCalledOnce();
      expect(transport.sessionId()).toMatch(uuidPattern);
    },
  );

  it.each([
    {
      label: "a rejected fetch without Beacon",
      navigator: {},
      fetch: vi.fn(() => Promise.reject(new Error("network unavailable"))),
    },
    {
      label: "both synchronous Beacon and fetch failures",
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
      const actionEvents = [
        { action: actions.search, event: browserEvents[1] },
        { action: actions.call, event: browserEvents[5] },
        { action: actions.route, event: browserEvents[6] },
        { action: actions.arrival, event: browserEvents[7] },
      ];

      for (const { action, event } of actionEvents) {
        if (!event) {
          throw new Error("Missing browser action event.");
        }
        expect(() => {
          transport.track(event);
          action();
        }).not.toThrow();
      }

      for (const action of Object.values(actions)) {
        expect(action).toHaveBeenCalledOnce();
      }
    },
  );
});
