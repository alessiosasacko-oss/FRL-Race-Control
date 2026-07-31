import type { ReactNode } from "react";
import { raceSessionLabels } from "@/domain";
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
    <section className="surface-panel rounded-2xl p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
        Ticketinformationen
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 text-sm xl:grid-cols-1">
        <Info title="Liga" value={ticket.league.name} />
        <Info title="Saison" value={ticket.season.name} />
        <Info title="Rennen" value={ticket.race.name} />
        <Info title="Session" value={raceSessionLabels[ticket.session]} />
        <Info title="Runde" value={ticket.lap ?? "–"} />
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
