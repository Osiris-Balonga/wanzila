export const FIXTURE_UPDATED_AT = new Date("2026-09-14T11:00:00.000Z");
export const DUTY_FIXTURE_REFERENCE_INSTANT = new Date(
  "2026-09-14T12:00:00.000Z",
);

export const pharmacies = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Pharmacie du Plateau",
    phone: "+242 06 000 00 01",
    address: "Avenue de la Paix, Plateau",
    district: "Plateau",
    arrondissement: "Poto-Poto",
    latitude: "-4.2637080",
    longitude: "15.2428850",
    status: "PUBLISHED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    name: "Pharmacie Moukondo",
    phone: "+242 06 000 00 02",
    address: "Avenue des Trois Martyrs, Moukondo",
    district: "Moukondo",
    arrondissement: "Moungali",
    latitude: "-4.2812570",
    longitude: "15.2558210",
    status: "PUBLISHED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    name: "Pharmacie de Bacongo",
    phone: "+242 06 000 00 03",
    address: "Rue du Commerce, Bacongo",
    district: "Bacongo",
    arrondissement: "Bacongo",
    latitude: "-4.2879090",
    longitude: "15.2531920",
    status: "PUBLISHED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
] as const;

export const scheduleSources = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    name: "Planning de garde démonstration Brazzaville",
    description:
      "Jeu de données local et de test; ne pas utiliser comme planning réel.",
    reliability: 80,
    observedAt: new Date("2026-09-14T11:30:00.000Z"),
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    name: "Source démonstration à vérifier",
    description:
      "Source synthétique volontairement ancienne pour couvrir la fraîcheur incertaine.",
    reliability: 40,
    observedAt: new Date("2026-09-10T12:00:00.000Z"),
    updatedAt: FIXTURE_UPDATED_AT,
  },
] as const;

export const dutyPeriods = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    pharmacyId: pharmacies[0].id,
    sourceId: scheduleSources[0].id,
    startsAt: new Date("2026-09-14T08:00:00.000Z"),
    endsAt: new Date("2026-09-14T20:00:00.000Z"),
    status: "APPROVED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    pharmacyId: pharmacies[1].id,
    sourceId: scheduleSources[0].id,
    startsAt: new Date("2026-09-14T20:00:00.000Z"),
    endsAt: new Date("2026-09-15T08:00:00.000Z"),
    status: "APPROVED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    pharmacyId: pharmacies[2].id,
    sourceId: scheduleSources[1].id,
    startsAt: new Date("2026-09-13T20:00:00.000Z"),
    endsAt: new Date("2026-09-14T08:00:00.000Z"),
    status: "APPROVED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000304",
    pharmacyId: pharmacies[1].id,
    sourceId: scheduleSources[1].id,
    startsAt: new Date("2026-09-14T08:00:00.000Z"),
    endsAt: new Date("2026-09-14T20:00:00.000Z"),
    status: "PENDING" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000305",
    pharmacyId: pharmacies[2].id,
    sourceId: scheduleSources[0].id,
    startsAt: new Date("2026-09-14T08:00:00.000Z"),
    endsAt: new Date("2026-09-14T20:00:00.000Z"),
    status: "APPROVED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000306",
    pharmacyId: pharmacies[0].id,
    sourceId: scheduleSources[0].id,
    startsAt: new Date("2026-09-14T08:00:00.000Z"),
    endsAt: new Date("2026-09-14T20:00:00.000Z"),
    status: "APPROVED" as const,
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
] as const;

export const dutyExceptions = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    dutyPeriodId: dutyPeriods[4].id,
    kind: "UNAVAILABLE" as const,
    startsAt: new Date("2026-09-14T10:00:00.000Z"),
    endsAt: new Date("2026-09-14T15:00:00.000Z"),
    reason: "Indisponibilité signalée dans le jeu de données de démonstration.",
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    dutyPeriodId: dutyPeriods[5].id,
    kind: "CANCELLED" as const,
    startsAt: new Date("2026-09-14T10:00:00.000Z"),
    endsAt: new Date("2026-09-14T15:00:00.000Z"),
    reason: "Annulation signalée dans le jeu de données de démonstration.",
    createdAt: FIXTURE_UPDATED_AT,
    updatedAt: FIXTURE_UPDATED_AT,
  },
] as const;

export const emergencyContacts = [
  {
    id: "00000000-0000-4000-8000-000000000501",
    label: "Urgences médicales démonstration",
    phone: "+242 06 000 01 01",
    position: 1,
    status: "PUBLISHED" as const,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    label: "Protection civile démonstration",
    phone: "+242 06 000 01 02",
    position: 2,
    status: "PUBLISHED" as const,
    updatedAt: FIXTURE_UPDATED_AT,
  },
] as const;

export const administrator = {
  id: "00000000-0000-4000-8000-000000000601",
  email: "admin.fixture@local.test",
  passwordHash: "local-test-only-password-hash-not-for-authentication",
  displayName: "Administrateur de démonstration",
  createdAt: FIXTURE_UPDATED_AT,
  updatedAt: FIXTURE_UPDATED_AT,
} as const;
