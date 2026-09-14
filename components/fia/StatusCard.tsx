import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import { TicketStatus, ticketStatusLabels } from "@/domain";
import type { FiaTicketDetail } from "@/lib/fia/types";

type StatusCardProps = {
  ticket: FiaTicketDetail;
  canReview?: boolean;
};

const workflow = [
  TicketStatus.Open,
  TicketStatus.InReview,
  TicketStatus.Resolved,
];

export default function StatusCard({
  ticket,
}: StatusCardProps) {
  const currentIndex = workflow.indexOf(ticket.status);
  return (
    <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
      <div className="flex items-center gap-2">
        <Clock3 className="text-violet-300" size={20} />
        <h2 className="text-xl font-bold text-white">Workflow</h2>
      </div>
      <ol className="mt-6 space-y-4">
        {workflow.map((status, index) => {
          const complete = index <= currentIndex;
          return (
            <li key={status} className="flex items-center gap-3">
              {complete ? (
                <CheckCircle2 className="text-violet-300" size={20} />
              ) : (
                <Circle className="text-slate-600" size={20} />
              )}
              <span className={complete ? "text-white" : "text-slate-500"}>
                {ticketStatusLabels[status]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
