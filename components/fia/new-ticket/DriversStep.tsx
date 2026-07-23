"use client";

import { useMemo, useState } from "react";
import { Check, Search, Users } from "lucide-react";
import type { TicketWizardOptions } from "@/lib/fia/types";
import type { TicketWizardDraft } from "./wizard-types";

type DriversStepProps = {
  data: TicketWizardDraft;
  options: TicketWizardOptions;
  setData: React.Dispatch<React.SetStateAction<TicketWizardDraft>>;
};

export default function DriversStep({
  data,
  options,
  setData,
}: DriversStepProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("de");
  const drivers = useMemo(
    () =>
      options.drivers.filter((driver) => {
        if (driver.leagueId !== Number(data.leagueId)) return false;
        if (!normalizedSearch) return true;

        return [
          driver.name,
          driver.team?.name ?? "",
          driver.team?.shortName ?? "",
          String(driver.number),
        ].some((value) =>
          value.toLocaleLowerCase("de").includes(normalizedSearch),
        );
      }),
    [data.leagueId, normalizedSearch, options.drivers],
  );

  function toggleDriver(driverId: number): void {
    setData((previous) => ({
      ...previous,
      driverIds: previous.driverIds.includes(driverId)
        ? previous.driverIds.filter((id) => id !== driverId)
        : [...previous.driverIds, driverId],
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Users className="text-blue-400" />
          <h2 className="text-3xl font-bold text-white">
            Beteiligte Fahrer
          </h2>
        </div>
        <p className="mt-2 text-slate-400">
          Suche in den aktiven Fahrern der gewählten Liga.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-blue-500">
        <Search size={18} className="text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, Team oder Startnummer suchen..."
          className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
        />
      </div>

      <p className="text-sm text-blue-300">
        {data.driverIds.length} Fahrer ausgewählt
      </p>

      <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {drivers.map((driver) => {
          const selected = data.driverIds.includes(driver.id);

          return (
            <button
              key={driver.id}
              type="button"
              onClick={() => toggleDriver(driver.id)}
              className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-900 hover:border-slate-500"
              }`}
            >
              <div>
                <p className="font-semibold text-white">
                  {driver.flag} #{driver.number} {driver.name}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {driver.team?.name ?? "Ohne Team"}
                </p>
              </div>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  selected ? "bg-blue-600 text-white" : "bg-slate-800"
                }`}
              >
                {selected ? <Check size={16} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {drivers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
          Keine passenden Fahrer gefunden.
        </div>
      ) : null}
    </div>
  );
}
