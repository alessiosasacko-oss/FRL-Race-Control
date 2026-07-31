import { History } from "lucide-react";
import {
  ticketAuditActionLabels,
  ticketStatusLabels,
} from "@/domain";
import type { FiaTicketDetail } from "@/lib/fia/types";

type HistoryCardProps = {
  ticket: FiaTicketDetail;
};

export default function HistoryCard({ ticket }: HistoryCardProps) {
  return (
    <section className="surface-panel rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <History className="text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-white">Audit-Verlauf</h2>
      </div>
      <ol className="mt-6 space-y-5 border-l border-slate-700 pl-5">
        {ticket.auditLog.map((entry) => (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[1.58rem] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-[#151B24]" />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-white">
                  {ticketAuditActionLabels[entry.action]}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {entry.details}
                </p>
                {entry.fromStatus && entry.toStatus ? (
                  <p className="mt-1 text-xs text-blue-300">
                    {ticketStatusLabels[entry.fromStatus]} →{" "}
                    {ticketStatusLabels[entry.toStatus]}
                  </p>
                ) : null}
              </div>
              <div className="text-xs text-slate-500 sm:text-right">
                <p>{entry.actor?.displayName ?? "System"}</p>
                <time>
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(entry.createdAt))}
                </time>
              </div>
            </div>
          </li>
        ))}
        {ticket.auditLog.length === 0 ? (
          <li className="text-sm text-slate-400">
            Noch keine Audit-Einträge vorhanden.
          </li>
        ) : null}
      </ol>
    </section>
  );
}
