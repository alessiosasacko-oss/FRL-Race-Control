import Link from "next/link";
import { CalendarDays, Flag, MapPin } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import Countdown from "./Countdown";
import DashboardCard from "./DashboardCard";

export default function NextRaceWidget({
  race,
}: {
  race: DashboardData["nextRace"];
}) {
  return (
    <DashboardCard icon={Flag} title="Nächstes Rennen">
      {race ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">
              Runde {race.round}
            </span>
            {race.sprint ? (
              <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-300">
                Sprint
              </span>
            ) : null}
            {race.mystery ? (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                Mystery
              </span>
            ) : null}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">{race.name}</h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <MapPin size={16} />
              {race.circuit}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <Countdown target={race.scheduledAt} />
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <CalendarDays size={16} />
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: race.timezone,
              }).format(new Date(race.scheduledAt))}
            </p>
          </div>
          <Link
            href="/calendar"
            className="wizard-secondary-button w-full"
          >
            Kalender öffnen
          </Link>
        </div>
      ) : (
        <p className="py-8 text-center text-slate-400">
          Kein kommendes Rennen geplant.
        </p>
      )}
    </DashboardCard>
  );
}
