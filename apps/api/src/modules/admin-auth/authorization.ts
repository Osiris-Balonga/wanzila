import { createHash } from "node:crypto";
import type { AdministratorSession } from "@wanzila/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiPrismaClient } from "../../infrastructure/prisma.js";
import {
  sendAuthenticationRequired,
  sendOriginForbidden,
} from "../shared/http-errors.js";

const SESSION_COOKIE_NAME = "wanzila_admin_session";

export interface AdministratorAuthentication {
  sessionId: string;
  session: AdministratorSession;
}

declare module "fastify" {
  interface FastifyRequest {
    administratorAuthentication?: AdministratorAuthentication;
  }
}

export function digestSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAllowedOriginPreHandler(options: { webOrigin: string }) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (request.headers.origin !== options.webOrigin) {
      sendOriginForbidden(reply);
    }
  };
}

export function createAdministratorAuthorizationPreHandler(options: {
  prisma: ApiPrismaClient | undefined;
  now: () => Date;
}) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) {
      sendAuthenticationRequired(reply);
      return;
    }

    if (!options.prisma) {
      sendAuthenticationRequired(reply);
      return;
    }

    const storedSession = await options.prisma.adminSession.findFirst({
      where: {
        tokenDigest: digestSessionToken(token),
        revokedAt: null,
        expiresAt: { gt: options.now() },
      },
      select: {
        id: true,
        expiresAt: true,
        adminUser: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    if (!storedSession) {
      sendAuthenticationRequired(reply);
      return;
    }

    request.administratorAuthentication = {
      sessionId: storedSession.id,
      session: {
        administrator: storedSession.adminUser,
        expiresAt: storedSession.expiresAt.toISOString(),
      },
    };
  };
}

export { SESSION_COOKIE_NAME };
