import { describe, expect, it, vi } from "vitest";

const SESSION_KEY = "wanzila.analytics.session.v1";
const analyticsTransportModule = "./transport.js";
const EVENT = {
  schemaVersion: 1 as const,
  name: "search_submitted" as const,
  properties: { queryLength: 12 },
};

class SessionStorageStub {
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
  sessionStorage: SessionStorageStub;
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

  it("uses sendBeacon when it accepts the payload and avoids fetch", async () => {
    const createAnalyticsTransport = await loadTransport();
    const sendBeacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
    const fetch =
      vi.fn<(input: string, init: RequestInit) => Promise<Response>>();
    const transport = createAnalyticsTransport({
      endpoint: "/api/v1/analytics/events",
      sessionStorage: new SessionStorageStub(),
      navigator: { sendBeacon },
      fetch,
    });

    expect(() => transport.track(EVENT)).not.toThrow();
    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(sendBeacon.mock.calls[0]?.[0]).toBe("/api/v1/analytics/events");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a non-throwing keepalive fetch fallback when sendBeacon is unavailable", async () => {
    const createAnalyticsTransport = await loadTransport();
    const fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );
    const transport = createAnalyticsTransport({
      endpoint: "/api/v1/analytics/events",
      sessionStorage: new SessionStorageStub(),
      navigator: {},
      fetch,
    });

    expect(() => transport.track(EVENT)).not.toThrow();
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/analytics/events",
      expect.objectContaining({
        keepalive: true,
        method: "POST",
      }),
    );
  });

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
    "never propagates $label into public actions",
    async ({ navigator, fetch }) => {
      const createAnalyticsTransport = await loadTransport();
      const transport = createAnalyticsTransport({
        endpoint: "/api/v1/analytics/events",
        sessionStorage: new SessionStorageStub(),
        navigator,
        fetch,
      });
      const actions = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];

      for (const action of actions) {
        expect(() => {
          transport.track(EVENT);
          action();
        }).not.toThrow();
      }

      for (const action of actions) {
        expect(action).toHaveBeenCalledOnce();
      }
    },
  );
});
