"use client";

import { Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Driver, Team } from "@/domain";
import CountryFlag from "@/components/ui/CountryFlag";
import TeamLogo from "@/components/teams/TeamLogo";

type SearchableDriver = Driver & {
  team: Team;
};

type Props = {
  drivers: SearchableDriver[];
  onSelect: (driver: SearchableDriver) => void;
};

export default function DriverSearch({
  drivers,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const filteredDrivers = useMemo(() => {
    if (!query.trim()) return drivers;

    return drivers.filter((driver) =>
      `${driver.name} ${driver.team.name} ${driver.number}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [query, drivers]);

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
        <Search className="text-slate-400" size={18} />

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Fahrer suchen..."
          className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
        />
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2">

        {filteredDrivers.length === 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-center text-slate-400">
            Kein Fahrer gefunden.
          </div>
        )}

        {filteredDrivers.map((driver) => (
          <button
            key={driver.id}
            onClick={() => onSelect(driver)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-[#151B24] p-4 transition hover:border-blue-500 hover:bg-slate-900"
          >
            <div className="text-left">

              <div className="flex items-center gap-3">

                <CountryFlag countryCode={driver.countryCode} fallbackFlag={driver.flag} />

                <div>

                  <p className="font-semibold text-white">
                    {driver.name}
                  </p>

                  <p className="flex items-center gap-2 text-sm text-slate-400"><TeamLogo logoUrl={driver.team.logoUrl} teamName={driver.team.name} shortName={driver.team.shortName} primaryColor={driver.team.color} size="xs" />{driver.team.name}</p>

                </div>

              </div>

            </div>

            <div className="flex items-center gap-4">

              <div className="rounded-lg bg-blue-600 px-3 py-1 font-bold text-white">
                #{driver.number}
              </div>

              <UserPlus
                size={18}
                className="text-blue-400"
              />

            </div>
          </button>
        ))}

      </div>

    </div>
  );
}
