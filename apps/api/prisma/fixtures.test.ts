import { describe, expect, it } from "vitest";
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

  it("contains the expected active, future, expired, uncertain, and overridden cases", () => {
    expect(dutyPeriods.map((duty) => duty.status)).toEqual([
      "APPROVED",
      "APPROVED",
      "APPROVED",
      "PENDING",
      "APPROVED",
      "APPROVED",
    ]);
    expect(dutyExceptions.map((exception) => exception.kind)).toEqual([
      "UNAVAILABLE",
      "CANCELLED",
    ]);
  });
});
