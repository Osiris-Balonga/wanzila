import { z } from "zod";

const administratorSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().trim().min(1).max(120),
  })
  .strict();

export const signInRequestSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1),
  })
  .strict();

export const administratorSessionSchema = z
  .object({
    administrator: administratorSchema,
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const administratorSessionResponseSchema = z
  .object({ data: administratorSessionSchema })
  .strict();

export const signedOutResponseSchema = z
  .object({ data: z.object({ signedOut: z.literal(true) }).strict() })
  .strict();

export const authenticationErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const protectedAdministratorResponseSchema = z
  .object({ data: z.object({ scope: z.literal("administrator") }).strict() })
  .strict();
