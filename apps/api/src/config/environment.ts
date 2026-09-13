import { z } from "zod";

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SERVE_WEB: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export function readEnvironment(environment: NodeJS.ProcessEnv) {
  const value = environmentSchema.parse(environment);
  return {
    port: value.API_PORT,
    webOrigin: value.WEB_ORIGIN,
    serveWeb: value.SERVE_WEB === "true",
    nodeEnvironment: value.NODE_ENV,
  };
}
