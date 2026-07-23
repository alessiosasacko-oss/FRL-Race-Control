import Link from "next/link";
import {
  ArrowRight,
  Flag,
  MapPin,
  Clock3,
} from "lucide-react";
import {
  ticketPriorityLabels,
  ticketStatusLabels,
  TicketPriority,
  TicketStatus,
  type FiaTicketWithRelations,
} from "@/domain";

type Props = {
  ticket: FiaTicketWithRelations;
};

export default function TicketCard({ ticket }: Props) {
  const statusClasses: Record<TicketStatus, string> = {
    [TicketStatus.Open]:
      "bg-red-500/15 text-red-400 border border-red-500/30",
    [TicketStatus.InReview]:
      "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
    [TicketStatus.Resolved]:
      "bg-green-500/15 text-green-400 border border-green-500/30",
  };

  const priorityClasses: Record<TicketPriority, string> = {
    [TicketPriority.High]: "bg-red-500/15 text-red-400",
    [TicketPriority.Normal]: "bg-yellow-500/15 text-yellow-300",
    [TicketPriority.Low]: "bg-green-500/15 text-green-400",
  };

  return (
    <Link href={`/fia/${ticket.id}`}>
      <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#151B24] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/70 hover:shadow-2xl hover:shadow-blue-500/20">

        {/* Blaue Seitenleiste */}
        <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />

        {/* Kopf */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
              {ticket.race.name}
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              {ticket.title}
            </h2>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusClasses[ticket.status]
            }`}
          >
            {ticketStatusLabels[ticket.status]}
          </span>
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
                    {driver.team.name}
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
            Runde {ticket.lap}
          </div>

          <div className="flex items-center gap-2">
            <MapPin size={16} />
            {ticket.corner}
          </div>

          <div className="flex items-center gap-2">
            <Clock3 size={16} />
            Heute
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              priorityClasses[ticket.priority]
            }`}
          >
            {ticketPriorityLabels[ticket.priority]}
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
      </div>
    </Link>
  );
}
