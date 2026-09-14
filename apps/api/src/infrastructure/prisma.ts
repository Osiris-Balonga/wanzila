import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

export type ApiPrismaClient = PrismaClient;

export function createPrismaClient(databaseUrl: string): ApiPrismaClient {
  return new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });
}
