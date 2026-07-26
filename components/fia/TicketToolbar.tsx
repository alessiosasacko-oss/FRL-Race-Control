import Link from "next/link";
import {
  Plus,
  Search,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import {
  fiaRaceSessions,
  TicketStatus,
  ticketStatusLabels,
} from "@/domain";
import { raceSessionLabels } from "@/domain";
import type {
  FiaListFilterOptions,
  FiaTicketListParams,
} from "@/lib/fia/types";

type TicketToolbarProps = {
  query: FiaTicketListParams;
  options: FiaListFilterOptions;
  canCreate: boolean;
};

export default function TicketToolbar({
  query,
  options,
  canCreate,
}: TicketToolbarProps) {
  return (
      <div className="mb-8 rounded-3xl border border-slate-800 bg-[#151B24] p-4 sm:p-6">
        {/* Oberer Bereich */}
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Untersuchungen
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Durchsuche und verwalte alle laufenden FIA-Untersuchungen.
            </p>
          </div>

          {canCreate ? (
            <Link
              href="/fia/new"
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              <Plus size={18} />
              Neues Ticket
            </Link>
          ) : null}
        </div>

        <form action="/fia" className="mt-6 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-blue-500">
            <Search size={18} className="text-slate-400" />

            <input
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Suche nach Ticket, Fahrer, Team oder Grand Prix..."
              className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
          >
            Suchen
          </button>
          <Link
            href="/fia"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-slate-300 transition hover:border-blue-500 hover:text-white"
          >
            <RotateCcw size={18} />
            Zurücksetzen
          </Link>
        </div>

        {/* Filter */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="mr-2 flex items-center gap-2 text-blue-400">
            <SlidersHorizontal size={18} />
            <span className="font-semibold">Filter</span>
          </div>

          <select name="leagueId" defaultValue={query.leagueId ?? ""} className="filter-select">
            <option value="">Alle Ligen</option>
            {options.leagues.map((league) => (
              <option key={league.id} value={league.id}>{league.code}</option>
            ))}
          </select>
          <select name="seasonId" defaultValue={query.seasonId ?? ""} className="filter-select">
            <option value="">Alle Saisons</option>
            {options.seasons.map((season) => (
              <option key={season.id} value={season.id}>{season.name}</option>
            ))}
          </select>
          <select name="raceId" defaultValue={query.raceId ?? ""} className="filter-select">
            <option value="">Alle Rennen</option>
            {options.races.map((race) => (
              <option key={race.id} value={race.id}>{race.name}</option>
            ))}
          </select>
          <select name="status" defaultValue={query.status ?? ""} className="filter-select">
            <option value="">Alle Status</option>
            {Object.values(TicketStatus).map((status) => (
              <option key={status} value={status}>{ticketStatusLabels[status]}</option>
            ))}
          </select>
          <select name="session" defaultValue={query.session ?? ""} className="filter-select">
            <option value="">Alle Sessions</option>
            {fiaRaceSessions.map((session) => (
              <option key={session} value={session}>{raceSessionLabels[session]}</option>
            ))}
          </select>
          <select name="sort" defaultValue={query.sort} className="filter-select">
            <option value="updatedAt">Zuletzt geändert</option>
            <option value="createdAt">Erstellt</option>
            <option value="title">Titel</option>
            <option value="status">Status</option>
          </select>
          <select name="direction" defaultValue={query.direction} className="filter-select">
            <option value="desc">Absteigend</option>
            <option value="asc">Aufsteigend</option>
          </select>
        </div>
        </form>
      </div>
  );
}
