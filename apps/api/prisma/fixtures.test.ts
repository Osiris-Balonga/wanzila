import { describe, expect, it } from "vitest";
import { resolveDutyState } from "@wanzila/domain";
import {
  administrator,
  dutyExceptions,
  dutyPeriods,
  DUTY_FIXTURE_REFERENCE_INSTANT,
  emergencyContacts,
  pharmacies,
  scheduleSources,
} from "./fixtures.js";

describe("database fixtures", () => {
  it("uses stable identifiers and deterministic timestamps", () => {
    const records = [
      ...pharmacies,
      ...scheduleSources,
      ...dutyPeriods,
      ...dutyExceptions,
      ...emergencyContacts,
      administrator,
    ];

    expect(new Set(records.map((record) => record.id)).size).toBe(
      records.length,
    );
    expect(DUTY_FIXTURE_REFERENCE_INSTANT.toISOString()).toBe(
      "2026-09-14T12:00:00.000Z",
    );
    expect(administrator.email).toMatch(/@local\.test$/);
  });

  it("resolves each deterministic duty fixture to its expected state", () => {
    const sourceById = new Map(
      scheduleSources.map((source) => [source.id, source]),
    );
    const exceptionsByDutyId = new Map<
      string,
      (typeof dutyExceptions)[number][]
    >();
    for (const exception of dutyExceptions) {
      const exceptions = exceptionsByDutyId.get(exception.dutyPeriodId) ?? [];
      exceptions.push(exception);
      exceptionsByDutyId.set(exception.dutyPeriodId, exceptions);
    }

    const statesByDutyId = Object.fromEntries(
      dutyPeriods.map((duty) => {
        const source = sourceById.get(duty.sourceId);
        if (!source) {
          throw new Error(
            `Fixture duty ${duty.id} references an unknown source.`,
          );
        }

        const state = resolveDutyState(
          {
            startsAt: duty.startsAt,
            endsAt: duty.endsAt,
            status: duty.status,
            sourceObservedAt: source.observedAt,
            exceptions: (exceptionsByDutyId.get(duty.id) ?? []).map(
              (exception) => ({
                kind: exception.kind,
                startsAt: exception.startsAt,
                endsAt: exception.endsAt,
              }),
            ),
          },
          {
            at: DUTY_FIXTURE_REFERENCE_INSTANT,
            sourceFreshnessMaxAgeMs: 60 * 60 * 1000,
          },
        );

        return [duty.id, state.state];
      }),
    );

    expect(statesByDutyId).toEqual({
      "00000000-0000-4000-8000-000000000301": "ACTIVE",
      "00000000-0000-4000-8000-000000000302": "FUTURE",
      "00000000-0000-4000-8000-000000000303": "EXPIRED",
      "00000000-0000-4000-8000-000000000304": "UNCERTAIN",
      "00000000-0000-4000-8000-000000000305": "UNAVAILABLE",
      "00000000-0000-4000-8000-000000000306": "CANCELLED",
    });
  });
});
