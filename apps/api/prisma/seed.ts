import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  administrator,
  dutyExceptions,
  dutyPeriods,
  emergencyContacts,
  pharmacies,
  scheduleSources,
} from "./fixtures.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

async function seed(): Promise<void> {
  for (const pharmacy of pharmacies) {
    await prisma.pharmacy.upsert({
      where: { id: pharmacy.id },
      update: pharmacy,
      create: pharmacy,
    });
  }

  for (const source of scheduleSources) {
    await prisma.scheduleSource.upsert({
      where: { id: source.id },
      update: source,
      create: source,
    });
  }

  for (const duty of dutyPeriods) {
    await prisma.dutyPeriod.upsert({
      where: { id: duty.id },
      update: duty,
      create: duty,
    });
  }

  for (const exception of dutyExceptions) {
    await prisma.dutyException.upsert({
      where: { id: exception.id },
      update: exception,
      create: exception,
    });
  }

  for (const contact of emergencyContacts) {
    await prisma.emergencyContact.upsert({
      where: { id: contact.id },
      update: contact,
      create: contact,
    });
  }

  await prisma.adminUser.upsert({
    where: { id: administrator.id },
    update: administrator,
    create: administrator,
  });
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
