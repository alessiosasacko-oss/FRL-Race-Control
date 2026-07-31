import Link from "next/link";
import {
  Bell,
  CalendarClock,
  ChevronRight,
  Flag,
  Medal,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AttendanceWidget from "@/components/dashboard/AttendanceWidget";
import NextRaceWidget from "@/components/dashboard/NextRaceWidget";
import QuickActionsWidget from "@/components/dashboard/QuickActionsWidget";
import RankingsWidget from "@/components/dashboard/RankingsWidget";
import SeasonProgressWidget from "@/components/dashboard/SeasonProgressWidget";
import WelcomeWidget from "@/components/dashboard/WelcomeWidget";
import MetricBlock from "@/components/ui/MetricBlock";
import SectionHeader from "@/components/ui/SectionHeader";
import { notificationTypeLabels } from "@/domain";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";
import { openNotificationAction } from "@/lib/notifications/actions";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const data = await getDashboardData(user.id);
  const unreadCount = data.notifications.filter(
    (notification) => !notification.readAt,
  ).length;

  return (
    <AppLayout>
      <div className="page-stack page-accent-dashboard">
        <WelcomeWidget identity={data.identity} />

        <NextRaceWidget
          race={data.nextRace}
          attendance={data.attendance}
          league={data.identity.driver?.league.code ?? null}
        />

        <section aria-labelledby="status-heading">
          <SectionHeader
            title="Dein Status"
            eyebrow="Race briefing"
            description="Die wichtigsten Werte für deinen nächsten Schritt."
          />
          <h2 id="status-heading" className="sr-only">
            Dein Status
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricBlock
              label="WM-Position"
              value={
                data.championship.driver
                  ? `P${data.championship.driver.position}`
                  : "–"
              }
              detail={
                data.championship.driver?.gapToLeader === 0
                  ? "Meisterschaftsführung"
                  : data.championship.driver
                    ? `${data.championship.driver.gapToLeader} Pkt. Rückstand`
                    : "Noch keine Wertung"
              }
              icon={Trophy}
              tone="yellow"
            />
            <MetricBlock
              label="Punkte"
              value={data.championship.driver?.points ?? "–"}
              detail={
                data.championship.driver
                  ? `${data.championship.driver.lastRacePoints} beim letzten Rennen`
                  : "Noch keine Saisonpunkte"
              }
              icon={Medal}
              tone="cyan"
            />
            <MetricBlock
              label="Offene FIA-Tickets"
              value={data.fia.openTickets}
              detail="Race-Control-Vorgänge"
              icon={ShieldAlert}
              tone={data.fia.openTickets > 0 ? "purple" : "green"}
            />
            <MetricBlock
              label="Ungelesen"
              value={unreadCount}
              detail="Neue Benachrichtigungen"
              icon={Bell}
              tone={unreadCount > 0 ? "orange" : "green"}
            />
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
          <section className="min-w-0">
            <SectionHeader
              title="Letzte Aktivitäten"
              description="Neuigkeiten und Race-Control-Entscheidungen chronologisch."
              action={
                <Link
                  href="/notifications"
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-blue-400 hover:text-blue-300"
                >
                  Alle ansehen <ChevronRight size={16} />
                </Link>
              }
            />
            <div className="surface-panel divide-y divide-slate-800/80 overflow-hidden">
              {data.notifications.slice(0, 4).map((notification, index) => (
                <form
                  key={notification.id}
                  action={openNotificationAction.bind(null, notification.id)}
                >
                  <button className="group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] gap-3 px-4 py-4 text-left transition hover:bg-blue-500/5 sm:px-5">
                    <span className="relative mt-1 flex justify-center">
                      <span
                        className={`size-2.5 rounded-full ${
                          notification.readAt ? "bg-slate-600" : "bg-blue-400"
                        }`}
                      />
                      {index < Math.min(data.notifications.length, 4) - 1 ? (
                        <span className="absolute top-4 h-12 w-px bg-slate-800" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-white group-hover:text-blue-200">
                        {notification.title}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-sm leading-6 text-slate-400">
                        {notification.message}
                      </span>
                      <span className="mt-2 block text-[0.68rem] font-bold uppercase tracking-[0.13em] text-slate-600">
                        {notificationTypeLabels[notification.type]}
                      </span>
                    </span>
                    <ChevronRight
                      size={17}
                      className="mt-1 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-blue-300"
                    />
                  </button>
                </form>
              ))}
              {data.notifications.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-400">
                  Noch keine aktuellen Aktivitäten.
                </div>
              ) : null}
            </div>
          </section>

          <div className="space-y-8">
            <section>
              <SectionHeader
                title="Race Operations"
                description="Anmeldung und schnelle Wege."
              />
              <div className="space-y-4">
                <AttendanceWidget
                  race={data.nextRace}
                  driverId={data.identity.driver?.id ?? null}
                  attendance={data.attendance}
                />
                <QuickActionsWidget />
              </div>
            </section>
          </div>
        </div>

        <section className="page-section">
          <SectionHeader
            title="Meisterschaft kompakt"
            description="Spitze des Feldes und Saisonfortschritt."
            action={
              <Link href="/championship" className="wizard-secondary-button">
                Vollständige Wertung
              </Link>
            }
          />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
            <RankingsWidget championship={data.championship} />
            <div className="space-y-5">
              <SeasonProgressWidget progress={data.seasonProgress} />
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                <div className="flex items-center gap-2 text-cyan-300">
                  <CalendarClock size={18} />
                  <p className="text-xs font-bold uppercase tracking-[0.14em]">
                    Nächster Termin
                  </p>
                </div>
                <p className="mt-3 font-semibold text-white">
                  {data.nextRace?.name ?? "Noch offen"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {data.nextRace
                    ? `Runde ${data.nextRace.round} · ${data.nextRace.circuit}`
                    : "Kein weiteres Rennen geplant"}
                </p>
                <Link
                  href="/calendar"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  <Flag size={15} />
                  Zum Kalender
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
