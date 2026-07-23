"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import NewTicketModal from "./NewTicketModal";

export default function TicketToolbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-8 rounded-3xl border border-slate-800 bg-[#151B24] p-6">
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

          <button
            onClick={() => setOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
          >
            <Plus size={18} />
            Neues Ticket
          </button>
        </div>

        {/* Suche */}
        <div className="mt-6 flex flex-col gap-4 xl:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-blue-500">
            <Search size={18} className="text-slate-400" />

            <input
              type="text"
              placeholder="Suche nach Ticket, Fahrer, Team oder Grand Prix..."
              className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-slate-300 transition hover:border-blue-500 hover:text-white">
            <RotateCcw size={18} />
            Zurücksetzen
          </button>
        </div>

        {/* Filter */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="mr-2 flex items-center gap-2 text-blue-400">
            <SlidersHorizontal size={18} />
            <span className="font-semibold">Filter</span>
          </div>

          {[
            ["Liga", ["F1", "F2", "F3", "F4", "F5", "F6"]],
            ["Saison", ["Season 7"]],
            ["Rennen", ["Alle Rennen"]],
            ["Status", ["Alle", "Offen", "In Bearbeitung", "Erledigt"]],
            ["Priorität", ["Alle", "Hoch", "Normal", "Niedrig"]],
          ].map(([label, options]) => (
            <select
              key={label}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white transition hover:border-blue-500"
            >
              <option>{label}</option>

              {(options as string[]).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <NewTicketModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}