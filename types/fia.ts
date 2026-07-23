export const TICKET_STATUSES = [
  "Offen",
  "In Bearbeitung",
  "Erledigt",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["Niedrig", "Normal", "Hoch"] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export type TicketDriver = {
  id: number;
  name: string;
  team: string;
  number: number;
  flag: string;
};

export type Ticket = {
  id: number;
  title: string;
  race: string;
  lap: number;
  corner: string;
  status: TicketStatus;
  priority: TicketPriority;
  drivers: TicketDriver[];
  description: string;
};
