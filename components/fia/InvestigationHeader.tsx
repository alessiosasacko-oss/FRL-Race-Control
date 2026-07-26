import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { FiaTicketDetail } from "@/lib/fia/types";
import StatusBadge from "./StatusBadge";

type InvestigationHeaderProps = {
  ticket: FiaTicketDetail;
};

export default function InvestigationHeader({
  ticket,
}: InvestigationHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-8">
      <Link
        href="/fia"
        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft size={16} /> Alle Untersuchungen
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-blue-400">
            FIA Investigation
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            {ticket.title}
          </h1>
          <p className="mt-2 text-slate-400">
            CASE #{String(ticket.id).padStart(4, "0")} · {ticket.league.code}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={ticket.status} />
        </div>
      </div>
    </div>
  );
}
