import PersonalDashboard from "@/components/dashboard/PersonalDashboard";
import DriverHero from "@/components/dashboard/DriverHero";
import NextRaceWidget from "@/components/dashboard/NextRaceWidget";
import AppLayout from "@/components/layout/AppLayout";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPersonalDashboardLayout } from "@/lib/dashboard/layout-queries";
import { getDashboardData } from "@/lib/dashboard/queries";
import type { DashboardWidgetData } from "@/lib/dashboard/types";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const dataPromise = getDashboardData(user.id, user.unreadNotificationCount);
  const layoutPromise = getPersonalDashboardLayout(
    user.id,
    user.roles,
    dataPromise.then((data) => Boolean(data.identity.driver)),
  );
  const [data, { layout, availableWidgetIds }] = await Promise.all([
    dataPromise,
    layoutPromise,
  ]);
  const widgetData = {
    nextRace: data.nextRace,
    championship: data.championship,
    seasonProgress: data.seasonProgress,
    latestResult: data.latestResult,
    teamFinance: data.teamFinance,
    notifications: data.notifications,
    unreadNotificationCount: data.unreadNotificationCount,
  } satisfies DashboardWidgetData;

  return (
    <AppLayout>
      <PersonalDashboard
        key={layout.updatedAt}
        data={widgetData}
        pinnedContent={
          <>
            <DriverHero data={data} />
            <NextRaceWidget race={data.nextRace} league={data.identity.driver?.league?.code ?? null} />
          </>
        }
        initialLayout={layout}
        availableWidgetIds={availableWidgetIds}
      />
    </AppLayout>
  );
}
