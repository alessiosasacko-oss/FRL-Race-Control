import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import {
  PenaltyType,
  penaltyTypeLabels,
} from "@/domain";
import { requirePermission } from "@/lib/auth/session";
import { Permission } from "@/lib/auth/permissions";
import {
  getFiaArchiveFilterOptions,
  getFiaArchiveList,
  parseFiaArchiveListParams,
} from "@/lib/fia/queries";
import type {
  FiaArchiveListItem,
  FiaArchiveListParams,
} from "@/lib/fia/types";

type FiaArchivePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function penaltyText(ticket: FiaArchiveListItem): string {
  const value = ticket.decision.penaltyValue;
  return `${penaltyTypeLabels[ticket.decision.penaltyType]}${
    value === null ? "" : ` (${value})`
  }`;
}

function pageHref(query: FiaArchiveListParams, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.leagueId) params.set("leagueId", String(query.leagueId));
  if (query.seasonId) params.set("seasonId", String(query.seasonId));
  if (query.raceId) params.set("raceId", String(query.raceId));
  if (query.driverId) params.set("driverId", String(query.driverId));
  if (query.decision) params.set("decision", query.decision);
  if (query.archivedFrom) params.set("archivedFrom", query.archivedFrom);
  if (query.archivedTo) params.set("archivedTo", query.archivedTo);
  params.set("page", String(page));
  return `/fia/archive?${params.toString()}`;
}

export default async function FiaArchivePage({
  searchParams,
}: FiaArchivePageProps) {
  await requirePermission(Permission.ViewRaceControl);
  const rawSearchParams = await searchParams;
  const query = parseFiaArchiveListParams(rawSearchParams);
  const [archiveResult, optionsResult] = await Promise.allSettled([
    getFiaArchiveList(query),
    getFiaArchiveFilterOptions(),
  ]);
  if (archiveResult.status === "rejected") {
    console.error("[fia-archive] Unable to load archive.", archiveResult.reason);
  }
  if (optionsResult.status === "rejected") {
    console.error(
      "[fia-archive] Unable to load archive filters.",
      optionsResult.reason,
    );
  }
  const archive =
    archiveResult.status === "fulfilled"
      ? archiveResult.value
      : {
          items: [],
          total: 0,
          page: 1,
          pageSize: query.pageSize,
          pageCount: 1,
        };
  const options =
    optionsResult.status === "fulfilled"
      ? optionsResult.value
      : { leagues: [], seasons: [], races: [], drivers: [] };

  return (
    <AppLayout>
      <div className="page-stack">
        <header className="overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-[#111827] to-[#172b4f] p-6 sm:p-8">
          <Link
            href="/fia"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Aktive FIA-Fälle
          </Link>
          <div className="mt-5 flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-blue-600 text-white">
              <Archive size={27} />
            </span>
            <div>
              <p className="eyebrow">Race Control records</p>
              <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">
                FIA-Archiv
              </h1>
              <p className="mt-2 text-slate-300">
                Abgeschlossene und archivierte FIA-Fälle
              </p>
            </div>
          </div>
        </header>

        {rawSearchParams.changed === "archived" ? (
          <p
            role="status"
            className="rounded-2xl border border-green-500/25 bg-green-500/10 px-5 py-4 text-sm text-green-200"
          >
            Das Ticket wurde archiviert. Sämtliche Inhalte und die Historie
            bleiben erhalten.
          </p>
        ) : null}

        <form
          action="/fia/archive"
          className="rounded-2xl border border-slate-800 bg-[#151B24] p-4 sm:p-5"
        >
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-4 focus-within:border-blue-500">
              <Search size={18} className="text-slate-400" />
              <span className="sr-only">Archiv durchsuchen</span>
              <input
                type="search"
                name="q"
                defaultValue={query.q}
                placeholder="Ticketnummer, Fahrer, Rennen oder Vorfall"
                className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <button
              type="submit"
              className="wizard-primary-button min-h-12 justify-center"
            >
              Suchen
            </button>
            <Link
              href="/fia/archive"
              className="wizard-secondary-button min-h-12 justify-center"
            >
              <RotateCcw size={17} />
              Zurücksetzen
            </Link>
          </div>

          <details
            open
            className="mt-4 rounded-xl border border-slate-800 p-4"
          >
            <summary className="cursor-pointer font-semibold text-white">
              Archivfilter
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select
                name="seasonId"
                defaultValue={query.seasonId ?? ""}
                className="filter-select"
              >
                <option value="">Alle Saisons</option>
                {options.seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
              <select
                name="leagueId"
                defaultValue={query.leagueId ?? ""}
                className="filter-select"
              >
                <option value="">Alle Ligen</option>
                {options.leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.code}
                  </option>
                ))}
              </select>
              <select
                name="raceId"
                defaultValue={query.raceId ?? ""}
                className="filter-select"
              >
                <option value="">Alle Rennen</option>
                {options.races.map((race) => (
                  <option key={race.id} value={race.id}>
                    {race.name}
                  </option>
                ))}
              </select>
              <select
                name="driverId"
                defaultValue={query.driverId ?? ""}
                className="filter-select"
              >
                <option value="">Alle Fahrer</option>
                {options.drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    #{driver.number} {driver.name}
                  </option>
                ))}
              </select>
              <select
                name="decision"
                defaultValue={query.decision ?? ""}
                className="filter-select"
              >
                <option value="">Alle Entscheidungen</option>
                {Object.values(PenaltyType).map((penalty) => (
                  <option key={penalty} value={penalty}>
                    {penaltyTypeLabels[penalty]}
                  </option>
                ))}
              </select>
              <label className="text-xs text-slate-400">
                Archiviert von
                <input
                  type="date"
                  name="archivedFrom"
                  defaultValue={query.archivedFrom}
                  className="form-control mt-1"
                />
              </label>
              <label className="text-xs text-slate-400">
                Archiviert bis
                <input
                  type="date"
                  name="archivedTo"
                  defaultValue={query.archivedTo}
                  className="form-control mt-1"
                />
              </label>
            </div>
          </details>
        </form>

        <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-[#151B24] lg:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Fall</th>
                <th className="px-4 py-3">Rennen / Liga</th>
                <th className="px-4 py-3">Fahrer</th>
                <th className="px-4 py-3">Entscheidung</th>
                <th className="px-4 py-3">Abschluss</th>
                <th className="px-4 py-3">Archivierung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {archive.items.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-blue-500/5">
                  <td className="px-4 py-4">
                    <Link
                      href={`/fia/${ticket.id}`}
                      className="font-semibold text-white hover:text-blue-300"
                    >
                      #{String(ticket.id).padStart(4, "0")} · {ticket.title}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    {ticket.race.name}
                    <span className="ml-2 rounded-md bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-300">
                      {ticket.league.code}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    {ticket.drivers
                      .map((driver) => driver.name)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200">
                      {penaltyText(ticket)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">
                    {formatDate(ticket.completedAt)}
                  </td>
                  <td className="px-4 py-4 text-slate-400">
                    {formatDate(ticket.archivedAt)}
                    <span className="mt-1 block text-xs">
                      {ticket.archivedBy?.displayName ?? "Unbekannt"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 lg:hidden">
          {archive.items.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/fia/${ticket.id}`}
              className="block rounded-2xl border border-slate-800 bg-[#151B24] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-blue-300">
                    CASE #{String(ticket.id).padStart(4, "0")}
                  </p>
                  <h2 className="mt-1 font-bold text-white">
                    {ticket.title}
                  </h2>
                </div>
                <span className="rounded-lg bg-blue-500/15 px-2 py-1 text-sm font-bold text-blue-300">
                  {ticket.league.code}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {ticket.race.name} ·{" "}
                {ticket.drivers.map((driver) => driver.name).join(", ")}
              </p>
              <p className="mt-3 text-sm font-semibold text-violet-200">
                {penaltyText(ticket)}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Archiviert {formatDate(ticket.archivedAt)} von{" "}
                {ticket.archivedBy?.displayName ?? "Unbekannt"}
              </p>
            </Link>
          ))}
        </div>

        {archive.items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-700 bg-[#151B24] p-10 text-center">
            <Archive className="mx-auto text-slate-500" size={30} />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Keine archivierten FIA-Fälle gefunden
            </h2>
            <p className="mt-2 text-slate-400">
              Passe Suche oder Filter an.
            </p>
          </section>
        ) : null}

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-[#151B24] p-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Seite {archive.page} von {archive.pageCount} · {archive.total}{" "}
            Tickets
          </p>
          <div className="flex gap-2">
            {archive.page > 1 ? (
              <Link
                href={pageHref(query, archive.page - 1)}
                className="pagination-link"
              >
                <ChevronLeft size={16} /> Zurück
              </Link>
            ) : (
              <span className="pagination-link pointer-events-none opacity-40">
                <ChevronLeft size={16} /> Zurück
              </span>
            )}
            {archive.page < archive.pageCount ? (
              <Link
                href={pageHref(query, archive.page + 1)}
                className="pagination-link"
              >
                Weiter <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="pagination-link pointer-events-none opacity-40">
                Weiter <ChevronRight size={16} />
              </span>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
