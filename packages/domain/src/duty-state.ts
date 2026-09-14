export const PRODUCT_TIME_ZONE = "Africa/Brazzaville" as const;

export type DutyReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DutyExceptionKind = "CANCELLED" | "UNAVAILABLE";
export type DutyState =
  "ACTIVE" | "FUTURE" | "EXPIRED" | "UNCERTAIN" | DutyExceptionKind;
export type SourceFreshness = "FRESH" | "STALE" | "UNKNOWN";

export interface DutyExceptionInput {
  kind: DutyExceptionKind;
  startsAt: Date;
  endsAt: Date;
}

export interface DutyPeriodInput {
  startsAt: Date;
  endsAt: Date;
  status: DutyReviewStatus;
  sourceObservedAt?: Date | null;
  exceptions?: readonly DutyExceptionInput[];
}

export interface DutyStateResult {
  state: DutyState;
  sourceFreshness: SourceFreshness;
}

export interface ResolveDutyStateOptions {
  at: Date;
  sourceFreshnessMaxAgeMs: number;
}

function assertValidInterval(
  startsAt: Date,
  endsAt: Date,
  label: string,
): void {
  if (!(endsAt.getTime() > startsAt.getTime())) {
    throw new RangeError(`${label} endsAt must be strictly after startsAt.`);
  }
}

function isInInterval(startsAt: Date, endsAt: Date, at: Date): boolean {
  return startsAt.getTime() <= at.getTime() && at.getTime() < endsAt.getTime();
}

export function getSourceFreshness(
  observedAt: Date | null | undefined,
  at: Date,
  maxAgeMs: number,
): SourceFreshness {
  if (!observedAt) {
    return "UNKNOWN";
  }

  if (maxAgeMs < 0) {
    throw new RangeError("sourceFreshnessMaxAgeMs must not be negative.");
  }

  return at.getTime() - observedAt.getTime() <= maxAgeMs ? "FRESH" : "STALE";
}

/**
 * Resolves a planned duty at an explicit instant. Source freshness is returned
 * separately because it describes the schedule data, never a guarantee that a
 * pharmacy is open.
 */
export function resolveDutyState(
  duty: DutyPeriodInput,
  options: ResolveDutyStateOptions,
): DutyStateResult {
  assertValidInterval(duty.startsAt, duty.endsAt, "Duty period");

  const sourceFreshness = getSourceFreshness(
    duty.sourceObservedAt,
    options.at,
    options.sourceFreshnessMaxAgeMs,
  );

  if (options.at.getTime() < duty.startsAt.getTime()) {
    return { state: "FUTURE", sourceFreshness };
  }

  if (options.at.getTime() >= duty.endsAt.getTime()) {
    return { state: "EXPIRED", sourceFreshness };
  }

  if (duty.status !== "APPROVED") {
    return { state: "UNCERTAIN", sourceFreshness };
  }

  for (const exception of duty.exceptions ?? []) {
    assertValidInterval(exception.startsAt, exception.endsAt, "Duty exception");
    if (isInInterval(exception.startsAt, exception.endsAt, options.at)) {
      return { state: exception.kind, sourceFreshness };
    }
  }

  return { state: "ACTIVE", sourceFreshness };
}

export function isDutyActive(
  duty: DutyPeriodInput,
  options: ResolveDutyStateOptions,
): boolean {
  return resolveDutyState(duty, options).state === "ACTIVE";
}
