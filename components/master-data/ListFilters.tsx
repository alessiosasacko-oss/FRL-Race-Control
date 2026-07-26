import Link from "next/link";
import { Search, RotateCcw } from "lucide-react";
import {
  RaceStatus,
  raceStatusLabels,
} from "@/domain";
import type {
  LeagueOption,
  SeasonOption,
} from "@/lib/master-data/types";
import type { MasterDataListQuery } from "@/lib/master-data/queries";

type ListFiltersProps = {
  action: string;
  query: MasterDataListQuery;
  leagues: LeagueOption[];
  seasons?: SeasonOption[];
  showStatus?: boolean;
  showActive?: boolean;
};

export default function ListFilters({
  action,
  query,
  leagues,
  seasons,
  showStatus,
  showActive,
}: ListFiltersProps) {
  return (
    <form action={action} className="master-card">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-blue-500">
          <Search size={18} className="text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Suchen…"
            className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
          />
        </label>
        <select
          name="leagueId"
          defaultValue={query.leagueId ?? ""}
          className="filter-select"
        >
          <option value="">Alle Ligen</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.code}
            </option>
          ))}
        </select>
        {seasons ? (
          <select
            name="seasonId"
            defaultValue={query.seasonId ?? ""}
            className="filter-select"
          >
            <option value="">Alle Saisons</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        ) : null}
        {showStatus ? (
          <select
            name="status"
            defaultValue={query.status ?? ""}
            className="filter-select"
          >
            <option value="">Alle Status</option>
            {Object.values(RaceStatus).map((status) => (
              <option key={status} value={status}>
                {raceStatusLabels[status]}
              </option>
            ))}
          </select>
        ) : null}
        {showActive ? (
          <select
            name="active"
            defaultValue={query.active}
            className="filter-select"
          >
            <option value="all">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
          </select>
        ) : null}
        <button className="wizard-primary-button">Filtern</button>
        <Link href={action} className="wizard-secondary-button">
          <RotateCcw size={17} /> Zurücksetzen
        </Link>
      </div>
    </form>
  );
}
