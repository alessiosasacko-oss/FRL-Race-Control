import "server-only";
import type { Role } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  availableDashboardWidgetIds,
  resolveDashboardLayout,
  type DashboardLayout,
  type DashboardWidgetId,
} from "@/lib/dashboard/layout";

export async function getPersonalDashboardLayout(
  userId: number,
  roles: readonly Role[],
  hasDriver: boolean,
): Promise<{ layout: DashboardLayout; availableWidgetIds: DashboardWidgetId[] }> {
  const settings = await getPrismaClient().userSettings.findUnique({
    where: { userId },
    select: { dashboardLayout: true },
  }).catch((error: unknown) => {
    console.error("[dashboard-layout] settings unavailable", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined,
    });
    return null;
  });
  const availableWidgetIds = availableDashboardWidgetIds(roles, hasDriver);
  return {
    layout: resolveDashboardLayout(settings?.dashboardLayout, availableWidgetIds),
    availableWidgetIds,
  };
}
