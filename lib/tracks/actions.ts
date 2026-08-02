"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { writeSystemAudit } from "@/lib/audit/system";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { trackSchema } from "@/lib/tracks/schemas";
import type { TrackActionState } from "@/lib/tracks/types";

function payload(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function errorState(message: string, fieldErrors?: Record<string, string[]>): TrackActionState {
  return { status: "error", message, fieldErrors };
}

function splitTrack(input: ReturnType<typeof trackSchema.parse>) {
  const {
    layoutAsset, layoutMimeType,
    primaryColor, secondaryColor, overlayStrength,
    lightBannerText, useThemeLayoutColor, layoutColor, lineWidth,
    showStartFinish, showSectors, showCornerNumbers,
    ...track
  } = input;
  return {
    track,
    visual: {
      layoutAsset: layoutAsset || null,
      layoutMimeType: layoutMimeType ?? null,
      primaryColor,
      secondaryColor,
      overlayStrength,
      lightBannerText,
      useThemeLayoutColor,
      layoutColor,
      lineWidth,
      showStartFinish,
      showSectors,
      showCornerNumbers,
    },
  };
}

async function revalidateTracks(): Promise<void> {
  revalidatePath("/admin/tracks");
  revalidatePath("/admin/races");
  revalidatePath("/calendar");
  await touchAppDataRevisionSafely(getPrismaClient(), ["calendar"]);
}

export async function createTrackAction(_state: TrackActionState, formData: FormData): Promise<TrackActionState> {
  const user = await requirePermission(Permission.ManageBranding);
  const parsed = trackSchema.safeParse(payload(formData));
  if (!parsed.success) return errorState("Bitte prüfe die Streckenangaben.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const data = splitTrack(parsed.data);
  try {
    const track = await getPrismaClient().track.create({
      data: { ...data.track, visual: { create: data.visual } },
    });
    await writeSystemAudit(getPrismaClient(), { actorId: user.id, action: "TRACK_CREATED", entityType: "Track", entityId: track.id });
  } catch {
    return errorState("Die Strecke konnte nicht gespeichert werden.");
  }
  await revalidateTracks();
  return { status: "success", message: "Strecke erstellt." };
}

export async function updateTrackAction(id: number, _state: TrackActionState, formData: FormData): Promise<TrackActionState> {
  const user = await requirePermission(Permission.ManageBranding);
  const parsed = trackSchema.safeParse(payload(formData));
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) return errorState("Bitte prüfe die Streckenangaben.");
  const data = splitTrack(parsed.data);
  try {
    await getPrismaClient().track.update({
      where: { id },
      data: { ...data.track, visual: { upsert: { create: data.visual, update: data.visual } } },
    });
    await writeSystemAudit(getPrismaClient(), { actorId: user.id, action: "TRACK_UPDATED", entityType: "Track", entityId: id });
  } catch {
    return errorState("Die Strecke konnte nicht aktualisiert werden.");
  }
  await revalidateTracks();
  return { status: "success", message: "Strecke aktualisiert." };
}

export async function deleteTrackAction(id: number): Promise<void> {
  const user = await requirePermission(Permission.ManageBranding);
  if (!Number.isInteger(id) || id <= 0) return;
  const track = await getPrismaClient().track.findUnique({ where: { id }, select: { _count: { select: { races: true } } } });
  if (!track || track._count.races > 0) return;
  await getPrismaClient().track.delete({ where: { id } });
  await writeSystemAudit(getPrismaClient(), { actorId: user.id, action: "TRACK_DELETED", entityType: "Track", entityId: id });
  await revalidateTracks();
}
