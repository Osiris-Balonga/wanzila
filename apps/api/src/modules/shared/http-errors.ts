import type { ApiError } from "@wanzila/contracts";
import type { FastifyReply } from "fastify";

const errors = {
  badRequest: {
    error: { code: "BAD_REQUEST", message: "Invalid request parameters" },
  },
  notFound: { error: { code: "NOT_FOUND", message: "Resource not found" } },
  rateLimited: {
    error: { code: "RATE_LIMITED", message: "Too many requests" },
  },
  clientError: { error: { code: "CLIENT_ERROR", message: "Request rejected" } },
} as const satisfies Record<string, ApiError>;

export function sendBadRequest(reply: FastifyReply): void {
  void reply.code(400).send(errors.badRequest);
}

export function sendNotFound(reply: FastifyReply): void {
  void reply.code(404).send(errors.notFound);
}

export function sendClientError(reply: FastifyReply, statusCode: number): void {
  const error =
    statusCode === 400
      ? errors.badRequest
      : statusCode === 404
        ? errors.notFound
        : statusCode === 429
          ? errors.rateLimited
          : errors.clientError;
  void reply.code(statusCode).send(error);
}

export function internalError(): ApiError {
  return {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
}
