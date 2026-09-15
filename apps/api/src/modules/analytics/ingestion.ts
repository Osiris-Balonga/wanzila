import type { AnalyticsEventEnvelope } from "@wanzila/contracts";
import type { ApiPrismaClient } from "../../infrastructure/prisma.js";

function splitPharmacyId(properties: AnalyticsEventEnvelope["properties"]) {
  if ("pharmacyId" in properties) {
    const { pharmacyId, ...analyticsProperties } = properties;
    return { pharmacyId, properties: analyticsProperties };
  }
  return { pharmacyId: null, properties };
}

export async function ingestAnalyticsEvent(options: {
  event: AnalyticsEventEnvelope;
  now: () => Date;
  prisma: ApiPrismaClient;
}) {
  const { pharmacyId, properties } = splitPharmacyId(options.event.properties);
  return options.prisma.analyticsEvent.create({
    data: {
      name: options.event.name,
      pharmacyId,
      properties,
      sessionId: options.event.sessionId,
      occurredAt: options.now(),
    },
  });
}
