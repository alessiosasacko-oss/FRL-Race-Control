import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FiaTicketListParams } from "@/lib/fia/types";

type TicketPaginationProps = {
  query: FiaTicketListParams;
  page: number;
  pageCount: number;
  total: number;
};

function pageHref(query: FiaTicketListParams, page: number): string {
  const params = new URLSearchParams();

  if (query.q) params.set("q", query.q);
  if (query.leagueId) params.set("leagueId", String(query.leagueId));
  if (query.seasonId) params.set("seasonId", String(query.seasonId));
  if (query.raceId) params.set("raceId", String(query.raceId));
  if (query.status) params.set("status", query.status);
  if (query.priority) params.set("priority", query.priority);
  if (query.session) params.set("session", query.session);
  params.set("sort", query.sort);
  params.set("direction", query.direction);
  params.set("page", String(page));

  return `/fia?${params.toString()}`;
}

export default function TicketPagination({
  query,
  page,
  pageCount,
  total,
}: TicketPaginationProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-[#151B24] p-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Seite {page} von {pageCount} · {total} Tickets
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={pageHref(query, page - 1)} className="pagination-link">
            <ChevronLeft size={16} /> Zurück
          </Link>
        ) : (
          <span className="pagination-link pointer-events-none opacity-40">
            <ChevronLeft size={16} /> Zurück
          </span>
        )}
        {page < pageCount ? (
          <Link href={pageHref(query, page + 1)} className="pagination-link">
            Weiter <ChevronRight size={16} />
          </Link>
        ) : (
          <span className="pagination-link pointer-events-none opacity-40">
            Weiter <ChevronRight size={16} />
          </span>
        )}
      </div>
    </div>
  );
}
