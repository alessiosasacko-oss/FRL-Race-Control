import Link from "next/link";
import {
  Bell,
  CalendarClock,
  Flag,
  ListOrdered,
  Medal,
  Trophy,
} from "lucide-react";
import MetricBlock from "@/components/ui/MetricBlock";
import type { DashboardData } from "@/lib/dashboard/types";
import type {
  DashboardWidgetItem,
  DashboardWidgetSize,
} from "@/lib/dashboard/layout";
import NotificationsWidget from "./NotificationsWidget";
import QuickActionsWidget from "./QuickActionsWidget";
import RankingsWidget from "./RankingsWidget";
import SeasonProgressWidget from "./SeasonProgressWidget";

export const dashboardWidgetSizeClasses: Record<DashboardWidgetSize, string> = {
  small: "md:col-span-1 lg:col-span-3",
  medium: "md:col-span-1 lg:col-span-6",
  large: "md:col-span-2 lg:col-span-8",
  full: "md:col-span-2 lg:col-span-12",
};

export default function DashboardWidgetContent({
  item,
  data,
}: {
  item: DashboardWidgetItem;
  data: DashboardData;
}) {
  switch (item.id) {
    case "quick-actions":
      return <QuickActionsWidget />;
    case "championship-position":
      return <MetricBlock label="WM-Position" value={data.championship.driver ? `P${data.championship.driver.position}` : "–"} detail={data.championship.driver?.gapToLeader === 0 ? "Meisterschaftsführung" : data.championship.driver ? `${data.championship.driver.gapToLeader} Pkt. Rückstand` : "Noch keine Wertung"} icon={Trophy} tone="yellow" className="h-full" />;
    case "championship-points":
      return <MetricBlock label="Saisonpunkte" value={data.championship.driver?.points ?? "–"} detail={data.championship.driver ? `${data.championship.driver.lastRacePoints} beim letzten Rennen` : "Noch keine Saisonpunkte"} icon={Medal} tone="cyan" className="h-full" />;
    case "latest-result":
      return <MetricBlock label="Letztes Ergebnis" value={data.latestResult?.position ? `P${data.latestResult.position}` : "–"} detail={data.latestResult ? `${data.latestResult.raceName} · ${data.latestResult.points} Pkt.` : "Noch kein Ergebnis veröffentlicht"} icon={ListOrdered} tone="blue" className="h-full" />;
    case "unread-notifications":
      return <MetricBlock label="Ungelesen" value={data.unreadNotificationCount} detail="Neue Benachrichtigungen" icon={Bell} tone={data.unreadNotificationCount > 0 ? "orange" : "green"} className="h-full" />;
    case "recent-activity":
      return <NotificationsWidget notifications={data.notifications.slice(0, 4)} />;
    case "rankings":
      return <RankingsWidget championship={data.championship} />;
    case "season-progress":
      return <SeasonProgressWidget progress={data.seasonProgress} />;
    case "next-calendar-event":
      return (
        <section className="surface-panel h-full p-5">
          <div className="flex items-center gap-2 text-blue-300"><CalendarClock size={18} /><h2 className="text-xs font-bold uppercase tracking-[0.14em]">Nächster Termin</h2></div>
          <p className="mt-3 font-semibold text-white">{data.nextRace?.name ?? "Noch offen"}</p>
          <p className="mt-1 text-sm text-slate-400">{data.nextRace ? `Runde ${data.nextRace.round} · ${data.nextRace.circuit}` : "Kein weiteres Rennen geplant"}</p>
          <Link href="/calendar" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300"><Flag size={15} /> Zum Kalender</Link>
        </section>
      );
  }
}
