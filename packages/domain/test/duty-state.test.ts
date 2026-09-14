import { describe, expect, it } from "vitest";
import {
  getSourceFreshness,
  isDutyActive,
  resolveDutyState,
  type DutyPeriodInput,
} from "../src/duty-state.js";

const startsAt = new Date("2026-09-14T10:00:00.000Z");
const endsAt = new Date("2026-09-14T14:00:00.000Z");
const sourceObservedAt = new Date("2026-09-14T11:30:00.000Z");

function resolve(
  duty: Partial<DutyPeriodInput>,
  at = new Date("2026-09-14T12:00:00.000Z"),
) {
  return resolveDutyState(
    {
      startsAt,
      endsAt,
      status: "APPROVED",
      sourceObservedAt,
      ...duty,
    },
    { at, sourceFreshnessMaxAgeMs: 60 * 60 * 1000 },
  );
}

describe("duty state", () => {
  it("uses an inclusive start and an exclusive end", () => {
    expect(resolve({}, startsAt)).toMatchObject({ state: "ACTIVE" });
    expect(resolve({}, endsAt)).toMatchObject({ state: "EXPIRED" });
  });

  it("separates future and expired periods from an active approved period", () => {
    expect(resolve({}, new Date("2026-09-14T09:59:59.999Z"))).toMatchObject({
      state: "FUTURE",
    });
    expect(resolve({}, new Date("2026-09-14T14:00:00.000Z"))).toMatchObject({
      state: "EXPIRED",
    });
  });

  it("never considers pending or rejected duties active", () => {
    expect(resolve({ status: "PENDING" })).toMatchObject({
      state: "UNCERTAIN",
    });
    expect(resolve({ status: "REJECTED" })).toMatchObject({
      state: "UNCERTAIN",
    });
    expect(
      isDutyActive(
        { startsAt, endsAt, status: "PENDING" },
        {
          at: new Date("2026-09-14T12:00:00.000Z"),
          sourceFreshnessMaxAgeMs: 1,
        },
      ),
    ).toBe(false);
  });

  it("gives an applicable exception precedence over an approved duty", () => {
    const exceptionWindow = {
      startsAt: new Date("2026-09-14T11:00:00.000Z"),
      endsAt: new Date("2026-09-14T13:00:00.000Z"),
    };

    expect(
      resolve({ exceptions: [{ kind: "CANCELLED", ...exceptionWindow }] }),
    ).toMatchObject({
      state: "CANCELLED",
    });
    expect(
      resolve({ exceptions: [{ kind: "UNAVAILABLE", ...exceptionWindow }] }),
    ).toMatchObject({
      state: "UNAVAILABLE",
    });
  });

  it("reports source freshness without changing the duty availability state", () => {
    const stale = resolve({
      sourceObservedAt: new Date("2026-09-14T10:00:00.000Z"),
    });

    expect(stale).toEqual({ state: "ACTIVE", sourceFreshness: "STALE" });
    expect(getSourceFreshness(undefined, startsAt, 60_000)).toBe("UNKNOWN");
  });

  it("rejects invalid intervals and freshness windows", () => {
    expect(() => resolve({ endsAt: startsAt })).toThrow(RangeError);
    expect(() =>
      resolve({
        exceptions: [{ kind: "CANCELLED", startsAt, endsAt: startsAt }],
      }),
    ).toThrow(RangeError);
    expect(() => getSourceFreshness(sourceObservedAt, startsAt, -1)).toThrow(
      RangeError,
    );
  });
});
