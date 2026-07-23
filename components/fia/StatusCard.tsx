import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import { TicketStatus, ticketStatusLabels } from "@/domain";
import { startFiaReviewAction } from "@/lib/fia/actions";
import type { FiaTicketDetail } from "@/lib/fia/types";

type StatusCardProps = {
  ticket: FiaTicketDetail;
  canReview: boolean;
};

const workflow = [
  TicketStatus.Open,
  TicketStatus.InReview,
  TicketStatus.Resolved,
];

export default function StatusCard({
  ticket,
  canReview,
}: StatusCardProps) {
  const currentIndex = workflow.indexOf(ticket.status);
  const startReview = startFiaReviewAction.bind(null, ticket.id);

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Clock3 className="text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-white">Workflow</h2>
      </div>
      <ol className="mt-6 space-y-4">
        {workflow.map((status, index) => {
          const complete = index <= currentIndex;
          return (
            <li key={status} className="flex items-center gap-3">
              {complete ? (
                <CheckCircle2 className="text-blue-400" size={20} />
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
      {ticket.status === TicketStatus.Open && canReview ? (
        <form action={startReview} className="mt-6">
          <button type="submit" className="wizard-primary-button w-full">
            Untersuchung beginnen
          </button>
        </form>
      ) : null}
    </section>
  );
}
