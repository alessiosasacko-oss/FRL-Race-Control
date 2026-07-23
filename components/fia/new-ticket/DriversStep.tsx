"use client";

import { Plus, Trash2, Users } from "lucide-react";
import type { Driver } from "@/domain";

export type DriverDraft = Pick<Driver, "id" | "name">;

type Props = {
  drivers: DriverDraft[];
  setDrivers: React.Dispatch<React.SetStateAction<DriverDraft[]>>;
};

export default function DriversStep({
  drivers,
  setDrivers,
}: Props) {
  function addDriver() {
    setDrivers((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
      },
    ]);
  }

  function updateDriver(id: number, value: string) {
    setDrivers((prev) =>
      prev.map((driver) =>
        driver.id === id
          ? {
              ...driver,
              name: value,
            }
          : driver
      )
    );
  }

  function removeDriver(id: number) {
    setDrivers((prev) => prev.filter((driver) => driver.id !== id));
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <Users className="text-blue-400" />

          <h2 className="text-3xl font-bold text-white">
            Beteiligte Fahrer
          </h2>
        </div>

        <p className="mt-2 text-slate-400">
          Füge alle beteiligten Fahrer hinzu.
        </p>
      </div>

      <button
        onClick={addDriver}
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
      >
        <Plus size={18} />
        Fahrer hinzufügen
      </button>

      <div className="space-y-4">
        {drivers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
            Noch keine Fahrer hinzugefügt.
          </div>
        )}

        {drivers.map((driver, index) => (
          <div
            key={driver.id}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">
                Fahrer {index + 1}
              </h3>

              <button
                onClick={() => removeDriver(driver.id)}
                className="rounded-lg p-2 text-red-400 transition hover:bg-red-500/20"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <input
              value={driver.name}
              onChange={(e) =>
                updateDriver(driver.id, e.target.value)
              }
              placeholder="Fahrer suchen..."
              className="w-full rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />

            <p className="mt-3 text-sm text-slate-500">
              Später erscheint hier eine Live-Suche mit Fahrer, Team,
              Startnummer und Flagge.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
