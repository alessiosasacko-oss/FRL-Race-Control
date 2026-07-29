import { Archive, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { FiaTicketDetail } from "@/lib/fia/types";
import StatusBadge from "./StatusBadge";

type InvestigationHeaderProps = {
  ticket: FiaTicketDetail;
};

export default function InvestigationHeader({
  ticket,
}: InvestigationHeaderProps) {
  return (
    <header className="relative isolate overflow-hidden rounded-[1.5rem] border border-violet-500/25 bg-[#111421] p-5 shadow-2xl shadow-violet-950/15 sm:p-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_10%,rgba(139,92,246,0.22),transparent_28%),linear-gradient(115deg,transparent_0_68%,rgba(255,255,255,0.025)_68%_69%,transparent_69%_100%)]"
      />
      <Link
        href={ticket.archivedAt ? "/fia/archive" : "/fia"}
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft size={16} />{" "}
        {ticket.archivedAt ? "FIA-Archiv" : "Alle Untersuchungen"}
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
            FIA Investigation · Case #{String(ticket.id).padStart(4, "0")}
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">
            {ticket.title}
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            {ticket.league.code} · {ticket.season.name} · {ticket.race.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={ticket.status} />
          {ticket.archivedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-200">
              <Archive size={14} />
              Archiviert
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
