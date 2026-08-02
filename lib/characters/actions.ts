"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { Permission } from "@/lib/auth/permissions";
import { requireAuthenticatedUser, requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { saveDriverCharacterSchema, teamSuitTemplateInputSchema } from "./schema";
import { z } from "zod";

export type CharacterActionState = { status: "success" | "error"; message: string };

function refreshCharacters() {
  for (const path of ["/dashboard", "/profile/character", "/drivers", "/drivers/[id]", "/championship", "/results/[id]"]) revalidatePath(path, path.includes("[id]") ? "page" : undefined);
}

export async function saveDriverCharacterAction(input: unknown): Promise<CharacterActionState> {
  const user = await requireAuthenticatedUser();
  const parsed = saveDriverCharacterSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Bitte prüfe die Charakterauswahl." };
  const prisma = getPrismaClient();
  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    select: { seasonAssignments: { where: { active: true, season: { active: true, archivedAt: null } }, take: 1, orderBy: { seasonId: "desc" }, select: { organizationId: true } } },
  });
  const organizationId = driver?.seasonAssignments[0]?.organizationId ?? null;
  if (parsed.data.suitVariantId) {
    const suit = await prisma.teamSuitTemplate.findFirst({ where: { id: parsed.data.suitVariantId, organizationId: organizationId ?? -1, active: true, archivedAt: null }, select: { id: true } });
    if (!suit) return { status: "error", message: "Diese Rennanzug-Variante gehört nicht zu deinem aktuellen Team." };
  }
  try {
    await prisma.driverCharacter.upsert({
      where: { userId: user.id },
      create: { userId: user.id, configuration: parsed.data.configuration as Prisma.InputJsonValue, normalPose: parsed.data.normalPose, winnerPose: parsed.data.winnerPose, suitVariantId: parsed.data.suitVariantId },
      update: { configuration: parsed.data.configuration as Prisma.InputJsonValue, normalPose: parsed.data.normalPose, winnerPose: parsed.data.winnerPose, suitVariantId: parsed.data.suitVariantId, version: { increment: 1 } },
    });
    await touchAppDataRevisionSafely(prisma, ["users", "drivers", "championship", "results"]);
    refreshCharacters();
    return { status: "success", message: "Charakter gespeichert." };
  } catch (error) {
    const reference = crypto.randomUUID();
    console.error("[driver-character] save failed", { reference, name: error instanceof Error ? error.name : "UnknownError", code: typeof error === "object" && error && "code" in error ? String(error.code) : undefined });
    return { status: "error", message: `Speichern fehlgeschlagen. Referenz: ${reference}` };
  }
}

export async function resetDriverCharacterAction(): Promise<CharacterActionState> {
  const user = await requireAuthenticatedUser();
  const prisma = getPrismaClient();
  await prisma.driverCharacter.deleteMany({ where: { userId: user.id } });
  await touchAppDataRevisionSafely(prisma, ["users", "drivers", "championship", "results"]);
  refreshCharacters();
  return { status: "success", message: "Standardcharakter wiederhergestellt." };
}

export async function saveTeamSuitTemplateAction(input: unknown): Promise<CharacterActionState> {
  await requirePermission(Permission.ManageBranding);
  const parsed = teamSuitTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Bitte prüfe die Anzugvorlage." };
  const prisma = getPrismaClient();
  const data = { organizationId: parsed.data.organizationId, name: parsed.data.name, configuration: parsed.data.configuration as Prisma.InputJsonValue, active: parsed.data.active, archivedAt: parsed.data.active ? null : new Date(), displayOrder: parsed.data.displayOrder };
  await (parsed.data.id ? prisma.teamSuitTemplate.update({ where: { id: parsed.data.id }, data }) : prisma.teamSuitTemplate.create({ data }));
  await touchAppDataRevisionSafely(prisma, ["design", "drivers", "results"]);
  revalidatePath("/admin/design/driver-suits");
  refreshCharacters();
  return { status: "success", message: "Rennanzug-Vorlage gespeichert." };
}

export async function archiveTeamSuitTemplateAction(idInput: number): Promise<CharacterActionState> {
  await requirePermission(Permission.ManageBranding);
  const id = z.number().int().positive().safeParse(idInput);
  if (!id.success) return { status: "error", message: "Ungültige Vorlage." };
  const prisma = getPrismaClient();
  await prisma.teamSuitTemplate.update({ where: { id: id.data }, data: { active: false, archivedAt: new Date() } });
  await touchAppDataRevisionSafely(prisma, ["design", "drivers", "results"]);
  revalidatePath("/admin/design/driver-suits");
  return { status: "success", message: "Vorlage archiviert." };
}
