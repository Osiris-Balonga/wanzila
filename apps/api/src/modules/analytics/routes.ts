import {
  analyticsAcceptedResponseSchema,
  analyticsBadRequestResponseSchema,
  analyticsEventEnvelopeSchema,
  analyticsPayloadTooLargeResponseSchema,
  analyticsRateLimitedResponseSchema,
} from "@wanzila/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ApiPrismaClient } from "../../infrastructure/prisma.js";
import { ingestAnalyticsEvent } from "./ingestion.js";

export const ANALYTICS_BODY_LIMIT_BYTES = 16 * 1024;

function sendAnalyticsBadRequest(reply: FastifyReply): void {
  void reply.code(400).send(
    analyticsBadRequestResponseSchema.parse({
      error: { code: "BAD_REQUEST", message: "Invalid analytics event" },
    }),
  );
}

export function sendAnalyticsPayloadTooLarge(reply: FastifyReply): void {
  void reply.code(413).send(
    analyticsPayloadTooLargeResponseSchema.parse({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Analytics payload too large",
      },
    }),
  );
}

export function sendAnalyticsRateLimited(reply: FastifyReply): void {
  void reply.code(429).send(
    analyticsRateLimitedResponseSchema.parse({
      error: { code: "RATE_LIMITED", message: "Too many analytics events" },
    }),
  );
}

export interface AnalyticsRouteOptions {
  prisma: ApiPrismaClient;
  now: () => Date;
  rateLimitMax: number;
}

function createAnalyticsRateLimiter(max: number) {
  const attempts = new Map<string, { count: number; expiresAt: number }>();
  const windowMilliseconds = 60 * 1000;

  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply | void> => {
    const timestamp = Date.now();
    const existing = attempts.get(request.ip);
    const state =
      existing && existing.expiresAt > timestamp
        ? existing
        : { count: 0, expiresAt: timestamp + windowMilliseconds };

    if (state.count >= max) {
      sendAnalyticsRateLimited(reply);
      return reply;
    }

    state.count += 1;
    attempts.set(request.ip, state);
  };
}

export function registerAnalyticsRoutes(
  app: FastifyInstance,
  options: AnalyticsRouteOptions,
): void {
  const rateLimit = createAnalyticsRateLimiter(options.rateLimitMax);
  app.post(
    "/api/v1/analytics/events",
    {
      bodyLimit: ANALYTICS_BODY_LIMIT_BYTES,
      config: { rateLimit: false },
      preHandler: rateLimit,
      errorHandler: (error, _request, reply) => {
        if (error.statusCode === 413) {
          sendAnalyticsPayloadTooLarge(reply);
          return;
        }
        void reply.send(error);
      },
    },
    async (request, reply): Promise<void> => {
      const event = analyticsEventEnvelopeSchema.safeParse(request.body);
      if (!event.success) {
        sendAnalyticsBadRequest(reply);
        return;
      }

      const stored = await ingestAnalyticsEvent({
        event: event.data,
        now: options.now,
        prisma: options.prisma,
      });
      const response = analyticsAcceptedResponseSchema.parse({
        data: {
          id: stored.id,
          receivedAt: stored.occurredAt.toISOString(),
        },
      });
      void reply.code(202).send(response);
    },
  );
}
