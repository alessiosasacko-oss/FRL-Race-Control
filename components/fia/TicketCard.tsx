import Link from "next/link";
import {
  ArrowRight,
  Flag,
  Clock3,
  MessageSquare,
  Paperclip,
  Vote,
} from "lucide-react";
import { raceSessionLabels } from "@/domain";
import type { FiaTicketListItem } from "@/lib/fia/types";
import StatusBadge from "./StatusBadge";

type Props = {
  ticket: FiaTicketListItem;
};

export default function TicketCard({ ticket }: Props) {
  const updatedAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ticket.updatedAt));

  return (
    <Link
      href={`/fia/${ticket.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-slate-800 bg-[#151B24] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/70 hover:shadow-2xl hover:shadow-blue-500/20 sm:p-6"
    >

        {/* Blaue Seitenleiste */}
        <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />

        {/* Kopf */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
              {ticket.race.name}
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              {ticket.title}
            </h2>
          </div>

          <StatusBadge status={ticket.status} />
        </div>

        {/* Fahrer */}
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {ticket.drivers.map((driver) => (
            <div
              key={driver.id}
              className="rounded-xl border border-slate-700 bg-[#1B2330] p-4 transition hover:border-blue-500/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">
                    {driver.flag} {driver.name}
                  </h3>

                  <p className="text-sm text-slate-400">
                    {driver.team?.name ?? "Ohne Team"}
                  </p>
                </div>

                <div className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-bold text-white">
                  #{driver.number}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Informationen */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">

          <div className="flex items-center gap-2">
            <Flag size={16} />
            {ticket.lap ? `Runde ${ticket.lap}` : raceSessionLabels[ticket.session]}
          </div>

          <div className="flex items-center gap-2">
            <Clock3 size={16} />
            {updatedAt}
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Paperclip size={14} /> {ticket.counts.evidence}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare size={14} /> {ticket.counts.discussionMessages}
            </span>
            <span className="flex items-center gap-1">
              <Vote size={14} /> {ticket.counts.votes}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-5">

          <span className="font-mono text-sm text-slate-500">
            CASE #{String(ticket.id).padStart(4, "0")}
          </span>

          <div className="flex items-center gap-2 font-semibold text-blue-400 transition-all group-hover:gap-3">
            Untersuchung öffnen
            <ArrowRight size={18} />
          </div>

        </div>
    </Link>
  );
}
