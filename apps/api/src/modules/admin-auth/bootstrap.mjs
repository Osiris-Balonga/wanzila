import "dotenv/config";
import argon2 from "argon2";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const invalidBootstrapMessage =
  "ADMIN_BOOTSTRAP_INVALID: Invalid administrator bootstrap credentials";

const bootstrapEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  WZ_ADMIN_BOOTSTRAP_EMAIL: z.string().trim().email(),
  WZ_ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).max(256),
  WZ_ADMIN_BOOTSTRAP_DISPLAY_NAME: z.string().trim().min(1).max(120),
});

async function bootstrapAdministrator() {
  const configured = bootstrapEnvironmentSchema.safeParse(process.env);
  if (!configured.success) {
    console.error(invalidBootstrapMessage);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(configured.data.DATABASE_URL),
  });
  try {
    const passwordHash = await argon2.hash(
      configured.data.WZ_ADMIN_BOOTSTRAP_PASSWORD,
      {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      },
    );
    await prisma.adminUser.upsert({
      where: { email: configured.data.WZ_ADMIN_BOOTSTRAP_EMAIL },
      create: {
        email: configured.data.WZ_ADMIN_BOOTSTRAP_EMAIL,
        displayName: configured.data.WZ_ADMIN_BOOTSTRAP_DISPLAY_NAME,
        passwordHash,
      },
      update: {
        displayName: configured.data.WZ_ADMIN_BOOTSTRAP_DISPLAY_NAME,
        passwordHash,
      },
    });
    console.info("Administrator bootstrap completed");
  } catch {
    console.error("ADMIN_BOOTSTRAP_FAILED: Administrator bootstrap failed");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrapAdministrator();
