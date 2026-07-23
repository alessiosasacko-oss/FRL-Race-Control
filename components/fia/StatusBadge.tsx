import {
  TicketStatus,
  ticketStatusLabels,
} from "@/domain";

const statusClasses: Record<TicketStatus, string> = {
  [TicketStatus.Open]:
    "border-red-500/30 bg-red-500/15 text-red-300",
  [TicketStatus.InReview]:
    "border-yellow-500/30 bg-yellow-500/15 text-yellow-200",
  [TicketStatus.Resolved]:
    "border-green-500/30 bg-green-500/15 text-green-300",
};

type StatusBadgeProps = {
  status: TicketStatus;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {ticketStatusLabels[status]}
    </span>
  );
}
