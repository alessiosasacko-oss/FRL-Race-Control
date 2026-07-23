import AppLayout from "@/components/layout/AppLayout";

import FIAHeader from "@/components/fia/FIAHeader";
import FIAStats from "@/components/fia/FIAStats";
import TicketToolbar from "@/components/fia/TicketToolbar";
import TicketCard from "@/components/fia/TicketCard";

import { tickets } from "@/lib/data/tickets";

export default function FIAPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <FIAHeader />

        <FIAStats />

        <TicketToolbar />

        <div className="grid gap-5">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}