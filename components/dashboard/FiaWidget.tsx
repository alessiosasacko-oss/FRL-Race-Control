import Link from "next/link";
import { Scale, ShieldAlert } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import DashboardCard from "./DashboardCard";

export default function FiaWidget({
  fia,
}: {
  fia: DashboardData["fia"];
}) {
  return (
    <DashboardCard icon={ShieldAlert} title="Latest FIA">
      <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Offene Tickets
        </p>
        <p className="mt-2 text-3xl font-bold text-white">
          {fia.openTickets}
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {fia.latestDecisions.map((decision) => (
          <Link
            key={decision.id}
            href={`/fia/${decision.ticketId}`}
            className="block rounded-xl border border-slate-800 p-3 transition hover:border-blue-500"
          >
            <p className="truncate text-sm font-semibold text-white">
              {decision.title}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {decision.penalty}
            </p>
          </Link>
        ))}
        {fia.latestDecisions.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-400">
            Keine aktuellen Entscheidungen.
          </p>
        ) : null}
      </div>
      {fia.currentPenalties.length > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-amber-300">
          <Scale size={16} />
          {fia.currentPenalties.length} aktuelle Strafentscheidung(en)
        </p>
      ) : null}
      <Link href="/fia" className="wizard-secondary-button mt-4 w-full">
        FIA Race Control
      </Link>
    </DashboardCard>
  );
}
