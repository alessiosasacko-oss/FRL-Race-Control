import {
  Flag,
  Timer,
  AlertTriangle,
  Shield,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Ticket } from "@/types/fia";

type Props = {
  ticket: Ticket;
};

export default function StatusCard({ ticket }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6">
      <h2 className="mb-6 text-xl font-bold text-white">
        Renninformationen
      </h2>

      <div className="space-y-5">

        <Row
          icon={<Flag size={18} />}
          title="Grand Prix"
          value={ticket.race}
        />

        <Row
          icon={<Timer size={18} />}
          title="Runde"
          value={ticket.lap}
        />

        <Row
          icon={<Shield size={18} />}
          title="Status"
          value={ticket.status}
        />

        <Row
          icon={<AlertTriangle size={18} />}
          title="Priorität"
          value={ticket.priority}
        />

      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  value,
}: {
  icon: ReactNode;
  title: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-3">

      <div className="flex items-center gap-3 text-slate-400">
        {icon}
        {title}
      </div>

      <div className="font-semibold text-white">
        {value}
      </div>

    </div>
  );
}
