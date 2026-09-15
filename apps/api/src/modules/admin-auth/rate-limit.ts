import type { FastifyReply, FastifyRequest } from "fastify";
import { sendRateLimited } from "../shared/http-errors.js";

const AUTHENTICATION_RATE_LIMIT_MAX = 5;
const AUTHENTICATION_RATE_LIMIT_WINDOW_MS = 60 * 1000;

interface AttemptWindow {
  attempts: number;
  expiresAt: number;
}

/** Keeps authentication attempts separate from the application's general limiter. */
export function createAuthenticationRateLimitPreHandler() {
  const attemptsByAddress = new Map<string, AttemptWindow>();

  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const now = Date.now();
    const current = attemptsByAddress.get(request.ip);
    if (!current || current.expiresAt <= now) {
      attemptsByAddress.set(request.ip, {
        attempts: 1,
        expiresAt: now + AUTHENTICATION_RATE_LIMIT_WINDOW_MS,
      });
      return;
    }
    if (current.attempts >= AUTHENTICATION_RATE_LIMIT_MAX) {
      sendRateLimited(reply);
      return;
    }
    current.attempts += 1;
  };
}
