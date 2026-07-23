import AppLayout from "@/components/layout/AppLayout";

import FIAHeader from "@/components/fia/FIAHeader";
import FIAStats from "@/components/fia/FIAStats";
import TicketToolbar from "@/components/fia/TicketToolbar";
import TicketCard from "@/components/fia/TicketCard";
import TicketPagination from "@/components/fia/TicketPagination";
import {
  getFiaListFilterOptions,
  getFiaTicketList,
  getFiaTicketStats,
  parseFiaTicketListParams,
} from "@/lib/fia/queries";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

type FIAPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FIAPage({ searchParams }: FIAPageProps) {
  const user = await requirePermission(Permission.ViewRaceControl);
  const query = parseFiaTicketListParams(await searchParams);
  const [tickets, stats, filterOptions] = await Promise.all([
    getFiaTicketList(query),
    getFiaTicketStats(),
    getFiaListFilterOptions(),
  ]);
  const canCreate = hasPermission(
    user.roles,
    Permission.SubmitFiaTicket,
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <FIAHeader openTickets={stats.open} />

        <FIAStats stats={stats} />

        <TicketToolbar
          query={query}
          options={filterOptions}
          canCreate={canCreate}
        />

        <div className="grid gap-5">
          {tickets.items.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
            />
          ))}
          {tickets.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#151B24] p-10 text-center">
              <h2 className="text-xl font-semibold text-white">
                Keine Tickets gefunden
              </h2>
              <p className="mt-2 text-slate-400">
                Passe die Suche oder Filter an.
              </p>
            </div>
          ) : null}
        </div>

        <TicketPagination
          query={query}
          page={tickets.page}
          pageCount={tickets.pageCount}
          total={tickets.total}
        />
      </div>
    </AppLayout>
  );
}
