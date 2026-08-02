"use server";

import { Prisma } from "@/generated/prisma/client";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import {
  availableDashboardWidgetIds,
  dashboardLayoutSchema,
  dashboardViewports,
  type DashboardLayout,
} from "@/lib/dashboard/layout";

export type DashboardLayoutActionResult = {
  status: "success" | "error";
  message: string;
  savedAt?: string;
};

export async function saveDashboardLayoutAction(
  layout: DashboardLayout,
): Promise<DashboardLayoutActionResult> {
  const user = await requireAuthenticatedUser();
  const parsed = dashboardLayoutSchema.safeParse(layout);
  if (!parsed.success) {
    return { status: "error", message: "Das Dashboard-Layout ist ungültig." };
  }

  const prisma = getPrismaClient();
  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  const allowed = new Set(availableDashboardWidgetIds(user.roles, Boolean(driver)));
  const containsForbiddenWidget = dashboardViewports.some((viewport) =>
    parsed.data[viewport].some((item) => !allowed.has(item.id)),
  );
  if (containsForbiddenWidget) {
    return { status: "error", message: "Dieses Widget steht für dein Profil nicht zur Verfügung." };
  }

  try {
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, dashboardLayout: parsed.data as Prisma.InputJsonValue },
      update: { dashboardLayout: parsed.data as Prisma.InputJsonValue },
    });
    await touchAppDataRevisionSafely(prisma, ["users"]);
    return { status: "success", message: "Dashboard gespeichert.", savedAt: new Date().toISOString() };
  } catch (error) {
    const reference = crypto.randomUUID();
    console.error("[dashboard-layout] save failed", {
      reference,
      name: error instanceof Error ? error.name : "UnknownError",
      code: typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined,
    });
    return { status: "error", message: `Speichern fehlgeschlagen. Referenz: ${reference}` };
  }
}

export async function resetDashboardLayoutAction(): Promise<DashboardLayoutActionResult> {
  const user = await requireAuthenticatedUser();
  const prisma = getPrismaClient();
  try {
    await prisma.userSettings.updateMany({
      where: { userId: user.id },
      data: { dashboardLayout: Prisma.JsonNull },
    });
    await touchAppDataRevisionSafely(prisma, ["users"]);
    return { status: "success", message: "FRL-Standardlayout wiederhergestellt.", savedAt: new Date().toISOString() };
  } catch (error) {
    const reference = crypto.randomUUID();
    console.error("[dashboard-layout] reset failed", {
      reference,
      name: error instanceof Error ? error.name : "UnknownError",
      code: typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined,
    });
    return { status: "error", message: `Zurücksetzen fehlgeschlagen. Referenz: ${reference}` };
  }
}
