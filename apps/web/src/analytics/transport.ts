import {
  analyticsSessionIdSchema,
  type AnalyticsEventEnvelope,
} from "@wanzila/contracts";

type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;

export interface AnalyticsTransportOptions {
  endpoint: string;
  sessionStorage?: SessionStorageLike;
  navigator?: Pick<Navigator, "sendBeacon">;
  fetch?: typeof globalThis.fetch;
}

function createSessionId(sessionStorage?: SessionStorageLike): string {
  let storedSessionId: string | null = null;
  try {
    storedSessionId =
      sessionStorage?.getItem("wanzila.analytics.session.v1") ?? null;
  } catch {
    // Analytics must remain best-effort when browser storage is unavailable.
  }

  if (
    storedSessionId !== null &&
    analyticsSessionIdSchema.safeParse(storedSessionId).success
  ) {
    return storedSessionId;
  }

  const sessionId = globalThis.crypto.randomUUID();
  try {
    sessionStorage?.setItem("wanzila.analytics.session.v1", sessionId);
  } catch {
    // A transient in-memory session remains sufficient for this tab.
  }
  return sessionId;
}

export function createAnalyticsTransport(options: AnalyticsTransportOptions) {
  const sessionId = createSessionId(options.sessionStorage);
  const browserNavigator = options.navigator ?? globalThis.navigator;
  const browserFetch = options.fetch ?? globalThis.fetch;

  function sendWithFetch(serialized: string): void {
    try {
      void browserFetch(options.endpoint, {
        body: serialized,
        headers: { "content-type": "application/json" },
        keepalive: true,
        method: "POST",
      }).catch(() => undefined);
    } catch {
      // Browser transport failures must never interrupt a public action.
    }
  }

  return {
    sessionId: (): string => sessionId,
    track: (event: Omit<AnalyticsEventEnvelope, "sessionId">): void => {
      const serialized = JSON.stringify({ ...event, sessionId });
      try {
        const accepted = browserNavigator?.sendBeacon?.(
          options.endpoint,
          new Blob([serialized], { type: "application/json" }),
        );
        if (accepted) {
          return;
        }
      } catch {
        // A synchronous Beacon error still receives the fetch fallback.
      }
      sendWithFetch(serialized);
    },
  };
}
