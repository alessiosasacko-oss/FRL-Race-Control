import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { internalTeamSlotKey } from "./team-lifecycle";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

/**
 * Returns the technical Team row required by legacy result and championship
 * relations. TeamOrganization remains the only user-visible team identity.
 */
export async function ensureInternalTeamSlot(
  database: DatabaseClient,
  input: {
    organizationId: number;
    seasonId: number;
    leagueId: number;
  },
): Promise<{ id: number }> {
  const organization = await database.teamOrganization.findFirst({
    where: {
      id: input.organizationId,
      active: true,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      shortName: true,
      color: true,
      secondaryColor: true,
      contrastColor: true,
      logoUrl: true,
    },
  });
  if (!organization) throw new Error("TEAM_ORGANIZATION_UNAVAILABLE");

  const slotKey = internalTeamSlotKey(input);
  const slotData = {
    name: organization.name,
    shortName: organization.shortName,
    color: organization.color,
    secondaryColor: organization.secondaryColor,
    contrastColor: organization.contrastColor,
    logoUrl: organization.logoUrl,
    principalUserId: null,
    active: true,
    archivedAt: null,
    systemManaged: true,
  } satisfies Prisma.TeamUncheckedUpdateInput;

  const keyedSlot = await database.team.findUnique({
    where: { internalSlotKey: slotKey },
    select: { id: true },
  });
  if (keyedSlot) {
    return database.team.update({
      where: { id: keyedSlot.id },
      data: slotData,
      select: { id: true },
    });
  }

  const legacySlot = await database.team.findFirst({
    where: {
      organizationId: input.organizationId,
      seasonId: input.seasonId,
      leagueId: input.leagueId,
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (legacySlot) {
    return database.team.update({
      where: { id: legacySlot.id },
      data: { ...slotData, internalSlotKey: slotKey },
      select: { id: true },
    });
  }

  return database.team.create({
    data: {
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      organizationId: input.organizationId,
      internalSlotKey: slotKey,
      ...slotData,
    },
    select: { id: true },
  });
}
