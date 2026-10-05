export type TeamRenderImages = { id: number; driverOneGraphicImageUrl: string | null; driverTwoGraphicImageUrl: string | null };

/** Only persisted result snapshots may choose team artwork, never the current Driver.teamId. */
export function resultTeamRenderImage(
  snapshot: { graphicSlot: number | null; graphicOrganizationId: number | null } | undefined,
  organizations: readonly TeamRenderImages[],
): string | null {
  const team = organizations.find((value) => value.id === snapshot?.graphicOrganizationId);
  return snapshot?.graphicSlot === 1 ? team?.driverOneGraphicImageUrl ?? null
    : snapshot?.graphicSlot === 2 ? team?.driverTwoGraphicImageUrl ?? null : null;
}
