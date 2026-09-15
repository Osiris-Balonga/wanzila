import { z } from "zod";

const administrativeFilterSchema = z.string().trim().min(1).max(120);
const pharmacyIdSchema = z.uuid();
const queryLengthSchema = z.number().int().min(0).max(180);
export const analyticsSessionIdSchema = z.uuid();

export const analyticsEventNameSchema = z.enum([
  "discovery_viewed",
  "search_submitted",
  "filters_applied",
  "empty_results_shown",
  "pharmacy_detail_viewed",
  "pharmacy_call_started",
  "route_started",
  "arrival_confirmed",
  "discovery_failed",
]);

const discoveryViewedEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.literal("discovery_viewed"),
    sessionId: analyticsSessionIdSchema,
    properties: z.object({}).strict(),
  })
  .strict();

const searchSubmittedEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.literal("search_submitted"),
    sessionId: analyticsSessionIdSchema,
    properties: z.object({ queryLength: queryLengthSchema }).strict(),
  })
  .strict();

const filtersAppliedEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.literal("filters_applied"),
    sessionId: analyticsSessionIdSchema,
    properties: z
      .object({
        district: administrativeFilterSchema.optional(),
        arrondissement: administrativeFilterSchema.optional(),
      })
      .strict()
      .refine(
        (properties) =>
          properties.district !== undefined ||
          properties.arrondissement !== undefined,
        "At least one administrative filter is required.",
      ),
  })
  .strict();

const emptyResultsShownEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.literal("empty_results_shown"),
    sessionId: analyticsSessionIdSchema,
    properties: z
      .object({ queryLength: queryLengthSchema, resultCount: z.literal(0) })
      .strict(),
  })
  .strict();

function pharmacyEventSchema(
  name: z.ZodLiteral<
    | "pharmacy_detail_viewed"
    | "pharmacy_call_started"
    | "route_started"
    | "arrival_confirmed"
  >,
) {
  return z
    .object({
      schemaVersion: z.literal(1),
      name,
      sessionId: analyticsSessionIdSchema,
      properties: z.object({ pharmacyId: pharmacyIdSchema }).strict(),
    })
    .strict();
}

const discoveryFailedEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.literal("discovery_failed"),
    sessionId: analyticsSessionIdSchema,
    properties: z
      .object({
        code: z.enum([
          "NETWORK_ERROR",
          "REQUEST_TIMEOUT",
          "SERVICE_UNAVAILABLE",
        ]),
      })
      .strict(),
  })
  .strict();

export const analyticsEventEnvelopeSchema = z.discriminatedUnion("name", [
  discoveryViewedEventSchema,
  searchSubmittedEventSchema,
  filtersAppliedEventSchema,
  emptyResultsShownEventSchema,
  pharmacyEventSchema(z.literal("pharmacy_detail_viewed")),
  pharmacyEventSchema(z.literal("pharmacy_call_started")),
  pharmacyEventSchema(z.literal("route_started")),
  pharmacyEventSchema(z.literal("arrival_confirmed")),
  discoveryFailedEventSchema,
]);

export const analyticsAcceptedResponseSchema = z
  .object({
    data: z
      .object({ id: z.uuid(), receivedAt: z.string().datetime() })
      .strict(),
  })
  .strict();

export const analyticsBadRequestResponseSchema = z
  .object({
    error: z
      .object({
        code: z.literal("BAD_REQUEST"),
        message: z.literal("Invalid analytics event"),
      })
      .strict(),
  })
  .strict();

export const analyticsPayloadTooLargeResponseSchema = z
  .object({
    error: z
      .object({
        code: z.literal("PAYLOAD_TOO_LARGE"),
        message: z.literal("Analytics payload too large"),
      })
      .strict(),
  })
  .strict();

export const analyticsRateLimitedResponseSchema = z
  .object({
    error: z
      .object({
        code: z.literal("RATE_LIMITED"),
        message: z.literal("Too many analytics events"),
      })
      .strict(),
  })
  .strict();

export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;
export type AnalyticsEventEnvelope = z.infer<
  typeof analyticsEventEnvelopeSchema
>;
export type AnalyticsAcceptedResponse = z.infer<
  typeof analyticsAcceptedResponseSchema
>;
