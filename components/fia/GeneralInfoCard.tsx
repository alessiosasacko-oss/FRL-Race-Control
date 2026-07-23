import type { ReactNode } from "react";
import {
  raceSessionLabels,
  ticketPriorityLabels,
} from "@/domain";
import type { FiaTicketDetail } from "@/lib/fia/types";

type GeneralInfoCardProps = {
  ticket: FiaTicketDetail;
};

export default function GeneralInfoCard({
  ticket,
}: GeneralInfoCardProps) {
  const createdAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ticket.createdAt));

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <h2 className="text-xl font-bold text-white">
        Allgemeine Informationen
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-5 text-sm">
        <Info title="Liga" value={ticket.league.name} />
        <Info title="Saison" value={ticket.season.name} />
        <Info title="Rennen" value={ticket.race.name} />
        <Info title="Session" value={raceSessionLabels[ticket.session]} />
        <Info title="Runde" value={ticket.lap ?? "–"} />
        <Info title="Kurve" value={ticket.corner ?? "–"} />
        <Info
          title="Priorität"
          value={ticketPriorityLabels[ticket.priority]}
        />
        <Info
          title="Gemeldet von"
          value={ticket.reportedBy?.displayName ?? "System"}
        />
        <Info title="Erstellt" value={createdAt} />
      </div>
    </section>
  );
}

function Info({ title, value }: { title: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-slate-500">{title}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
