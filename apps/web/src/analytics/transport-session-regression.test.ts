import { analyticsSessionIdSchema } from "@wanzila/contracts";
import { expect, it, vi } from "vitest";
import { createAnalyticsTransport } from "./transport.js";

it("replaces a 36-character non-UUID sessionStorage value", () => {
  const invalidSessionId = "------------------------------------";
  let storedSessionId = invalidSessionId;
  const setItem = vi.fn((key: string, value: string) => {
    if (key === "wanzila.analytics.session.v1") {
      storedSessionId = value;
    }
  });

  const transport = createAnalyticsTransport({
    endpoint: "/api/v1/analytics/events",
    sessionStorage: { getItem: () => storedSessionId, setItem },
  });

  const sessionId = transport.sessionId();
  expect(analyticsSessionIdSchema.safeParse(sessionId).success).toBe(true);
  expect(sessionId).not.toBe(invalidSessionId);
  expect(setItem).toHaveBeenCalledWith(
    "wanzila.analytics.session.v1",
    sessionId,
  );
  expect(storedSessionId).toBe(sessionId);
});
