import { z } from "zod";

export const administratorSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().trim().min(1).max(120),
  })
  .strict();

export const administratorSignInRequestSchema = z
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

export const administratorSignedOutResponseSchema = z
  .object({ data: z.object({ signedOut: z.literal(true) }).strict() })
  .strict();

export type AdministratorSession = z.infer<typeof administratorSessionSchema>;
export type AdministratorSessionResponse = z.infer<
  typeof administratorSessionResponseSchema
>;
export type AdministratorSignedOutResponse = z.infer<
  typeof administratorSignedOutResponseSchema
>;
