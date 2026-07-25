import AppLayout from "@/components/layout/AppLayout";
import AttendanceWidget from "@/components/dashboard/AttendanceWidget";
import ChampionshipWidget from "@/components/dashboard/ChampionshipWidget";
import FiaWidget from "@/components/dashboard/FiaWidget";
import NextRaceWidget from "@/components/dashboard/NextRaceWidget";
import NotificationsWidget from "@/components/dashboard/NotificationsWidget";
import QuickActionsWidget from "@/components/dashboard/QuickActionsWidget";
import RankingsWidget from "@/components/dashboard/RankingsWidget";
import SeasonProgressWidget from "@/components/dashboard/SeasonProgressWidget";
import WelcomeWidget from "@/components/dashboard/WelcomeWidget";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const data = await getDashboardData(user.id);

  return (
    <AppLayout>
      <div className="space-y-6">
        <WelcomeWidget identity={data.identity} />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <NextRaceWidget race={data.nextRace} />
          <AttendanceWidget
            race={data.nextRace}
            driverId={data.identity.driver?.id ?? null}
            attendance={data.attendance}
          />
          <ChampionshipWidget championship={data.championship} />
          <RankingsWidget championship={data.championship} />
          <SeasonProgressWidget progress={data.seasonProgress} />
          <FiaWidget fia={data.fia} />
          <NotificationsWidget notifications={data.notifications} />
          <QuickActionsWidget />
        </div>
      </div>
    </AppLayout>
  );
}
