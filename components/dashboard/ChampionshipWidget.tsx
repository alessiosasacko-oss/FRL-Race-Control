import Link from "next/link";
import { Medal, Trophy } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import DashboardCard from "./DashboardCard";

function StandingBlock({
  label,
  standing,
}: {
  label: string;
  standing: {
    position: number;
    points: number;
    gapToLeader: number;
  } | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500">
        {label}
      </p>
      {standing ? (
        <>
          <p className="mt-2 text-2xl font-bold text-white">
            P{standing.position} · {standing.points} Pkt.
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {standing.gapToLeader === 0
              ? "Meisterschaftsführung"
              : `${standing.gapToLeader} Punkte Rückstand`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          Noch keine Wertung.
        </p>
      )}
    </div>
  );
}

export default function ChampionshipWidget({
  championship,
}: {
  championship: DashboardData["championship"];
}) {
  return (
    <DashboardCard icon={Trophy} title="Meisterschaft">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <StandingBlock label="Fahrer" standing={championship.driver} />
        <StandingBlock label="Team" standing={championship.team} />
      </div>
      {championship.driver ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Medal size={16} className="text-amber-400" />
          Letztes Rennen: {championship.driver.lastRacePoints} Punkte
        </p>
      ) : null}
      <Link
        href="/championship"
        className="wizard-secondary-button mt-4 w-full"
      >
        Tabellen öffnen
      </Link>
    </DashboardCard>
  );
}
