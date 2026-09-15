import { z } from "zod";

const identifierSchema = z.uuid();
const textSchema = z.string().trim().min(1);
const timestampSchema = z.string().datetime({ offset: true });

export const adminPharmacyStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export const adminPharmacySchema = z
  .object({
    id: identifierSchema,
    name: textSchema.max(180),
    address: z
      .object({
        line: textSchema.max(255),
        district: textSchema.max(120),
        arrondissement: textSchema.max(120),
      })
      .strict(),
    phone: textSchema.max(32).optional(),
    coordinates: z
      .object({
        latitude: z.number().finite().gte(-90).lte(90),
        longitude: z.number().finite().gte(-180).lte(180),
      })
      .strict(),
    status: adminPharmacyStatusSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const adminPharmacyListResponseSchema = z
  .object({
    data: z.array(adminPharmacySchema),
    pagination: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const adminPharmacyResponseSchema = z
  .object({ data: adminPharmacySchema })
  .strict();

export const adminPharmacyErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          "BAD_REQUEST",
          "NOT_FOUND",
          "AUTHENTICATION_REQUIRED",
          "ORIGIN_FORBIDDEN",
          "CONFLICT",
        ]),
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const createAdminPharmacyRequestSchema = z
  .object({
    name: textSchema.max(180),
    address: z
      .object({
        line: textSchema.max(255),
        district: textSchema.max(120),
        arrondissement: textSchema.max(120),
      })
      .strict(),
    phone: textSchema.max(32).optional(),
    coordinates: z
      .object({
        latitude: z.number().finite().gte(-90).lte(90),
        longitude: z.number().finite().gte(-180).lte(180),
      })
      .strict(),
  })
  .strict();

export const updateAdminPharmacyRequestSchema = createAdminPharmacyRequestSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one pharmacy field is required.",
  );

export const adminPharmacyListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    name: textSchema.max(180).optional(),
    district: textSchema.max(120).optional(),
    arrondissement: textSchema.max(120).optional(),
    status: adminPharmacyStatusSchema.optional(),
  })
  .strict();
