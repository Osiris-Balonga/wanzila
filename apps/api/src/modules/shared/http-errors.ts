import type { ApiError } from "@wanzila/contracts";
import type { FastifyReply } from "fastify";

const errors = {
  badRequest: {
    error: { code: "BAD_REQUEST", message: "Invalid request parameters" },
  },
  notFound: { error: { code: "NOT_FOUND", message: "Resource not found" } },
} as const satisfies Record<string, ApiError>;

export function sendBadRequest(reply: FastifyReply): void {
  void reply.code(400).send(errors.badRequest);
}

export function sendNotFound(reply: FastifyReply): void {
  void reply.code(404).send(errors.notFound);
}

export function internalError(): ApiError {
  return {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
}
