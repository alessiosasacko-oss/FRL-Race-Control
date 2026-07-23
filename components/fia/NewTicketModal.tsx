"use client";

import { X, Upload, Link2, AlertTriangle } from "lucide-react";
import {
  TicketPriority,
  ticketPriorityLabels,
} from "@/domain";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NewTicketModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95%] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-slate-700 bg-[#151B24] shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-[#151B24] p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-400">
              FIA RACE CONTROL
            </p>

            <h2 className="mt-1 text-3xl font-bold text-white">
              Neues Ticket
            </h2>

            <p className="mt-2 text-slate-400">
              Erstelle eine neue Untersuchung.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X />
          </button>
        </div>

        <div className="space-y-8 p-6">

          {/* Allgemein */}
          <section>
            <h3 className="mb-4 text-lg font-semibold text-white">
              Allgemeine Informationen
            </h3>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Liga
                </label>

                <select className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white">
                  <option>F1</option>
                  <option>F2</option>
                  <option>F3</option>
                  <option>F4</option>
                  <option>F5</option>
                  <option>F6</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Saison
                </label>

                <select className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white">
                  <option>Season 7</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Grand Prix
                </label>

                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                  placeholder="Belgium GP"
                />
              </div>

            </div>
          </section>

          {/* Fahrer */}
          <section>
            <h3 className="mb-4 text-lg font-semibold text-white">
              Beteiligte Fahrer
            </h3>

            <div className="grid gap-5 md:grid-cols-2">

              <input
                className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                placeholder="Fahrer 1 suchen..."
              />

              <input
                className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                placeholder="Fahrer 2 suchen..."
              />

            </div>
          </section>

          {/* Vorfall */}
          <section>
            <h3 className="mb-4 text-lg font-semibold text-white">
              Vorfall
            </h3>

            <div className="grid gap-5 md:grid-cols-3">

              <input
                className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                placeholder="Runde"
              />

              <input
                className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                placeholder="Kurve"
              />

              <select className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white">
                <option>Kollision</option>
                <option>Track Limits</option>
                <option>Unsafe Release</option>
                <option>Blocking</option>
                <option>Gelbe Flaggen</option>
                <option>Sonstiges</option>
              </select>

            </div>

            <textarea
              rows={6}
              className="mt-5 w-full rounded-xl border border-slate-700 bg-slate-900 p-4 text-white"
              placeholder="Beschreibe den Vorfall möglichst genau..."
            />
          </section>

          {/* Beweise */}
          <section>
            <h3 className="mb-4 text-lg font-semibold text-white">
              Beweise
            </h3>

            <div className="grid gap-5 md:grid-cols-2">

              <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
                <Link2 className="text-blue-400" />

                <input
                  className="w-full bg-transparent text-white outline-none"
                  placeholder="Replay- oder YouTube-Link"
                />
              </div>

              <button className="flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 p-4 text-slate-300 transition hover:border-blue-500 hover:text-white">
                <Upload size={18} />
                Screenshot hochladen
              </button>

            </div>
          </section>

          {/* Priorität */}
          <section>
            <h3 className="mb-4 text-lg font-semibold text-white">
              Priorität
            </h3>

            <div className="flex gap-4">

              {Object.values(TicketPriority).map((priority) => (
                <button
                  key={priority}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-white transition hover:border-blue-500"
                >
                  <AlertTriangle size={16} />
                  {ticketPriorityLabels[priority]}
                </button>
              ))}

            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-800 bg-[#151B24] p-6">

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-5 py-3 text-white transition hover:bg-slate-800"
          >
            Abbrechen
          </button>

          <button className="rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white transition hover:bg-blue-500">
            Ticket erstellen
          </button>

        </div>

      </div>
    </>
  );
}
