import {
  TicketPriority,
  ticketPriorityLabels,
} from "@/domain";

const priorityClasses: Record<TicketPriority, string> = {
  [TicketPriority.High]: "bg-red-500/15 text-red-300",
  [TicketPriority.Normal]: "bg-yellow-500/15 text-yellow-200",
  [TicketPriority.Low]: "bg-green-500/15 text-green-300",
};

type PriorityBadgeProps = {
  priority: TicketPriority;
};

export default function PriorityBadge({
  priority,
}: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityClasses[priority]}`}
    >
      {ticketPriorityLabels[priority]}
    </span>
  );
}
