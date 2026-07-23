import type { ReactNode } from "react";
import type { Ticket } from "@/types/fia";

type Props = {
  ticket: Ticket;
};

export default function GeneralInfoCard({ ticket }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6">
      <h2 className="mb-6 text-xl font-bold text-white">
        Allgemeine Informationen
      </h2>

      <div className="grid grid-cols-2 gap-6 text-sm">
        <Info title="Rennen" value={ticket.race} />
        <Info title="Runde" value={ticket.lap} />
        <Info title="Kurve" value={ticket.corner} />
        <Info title="Priorität" value={ticket.priority} />
      </div>
    </div>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-slate-500">{title}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
