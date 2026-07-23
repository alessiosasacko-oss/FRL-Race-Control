"use client";

import { AlertTriangle, ClipboardList } from "lucide-react";
import {
  TicketPriority,
  ticketPriorityLabels,
} from "@/domain";

export type IncidentData = {
  title: string;
  lap: string;
  corner: string;
  priority: TicketPriority;
  description: string;
};

type Props = {
  data: IncidentData;
  setData: React.Dispatch<React.SetStateAction<IncidentData>>;
};

export default function IncidentStep({
  data,
  setData,
}: Props) {
  const priorities = Object.values(TicketPriority);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <ClipboardList className="text-blue-400" />

          <h2 className="text-3xl font-bold text-white">
            Vorfall
          </h2>
        </div>

        <p className="mt-2 text-slate-400">
          Gib die Informationen zum Vorfall an.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Titel des Vorfalls
        </label>

        <input
          value={data.title}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              title: e.target.value,
            }))
          }
          placeholder="z.B. Kontakt zwischen Car 7 und Car 18 in Kurve 4"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Runde
          </label>

          <input
            value={data.lap}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                lap: e.target.value,
              }))
            }
            placeholder="12"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Kurve
          </label>

          <input
            value={data.corner}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                corner: e.target.value,
              }))
            }
            placeholder="Turn 4"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-slate-300">
          Priorität
        </label>

        <div className="flex flex-wrap gap-3">
          {priorities.map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  priority,
                }))
              }
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 font-medium transition ${
                data.priority === priority
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500"
              }`}
            >
              <AlertTriangle size={16} />
              {ticketPriorityLabels[priority]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Beschreibung
        </label>

        <textarea
          rows={8}
          value={data.description}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          placeholder="Beschreibe den Vorfall so detailliert wie möglich..."
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 text-white outline-none transition focus:border-blue-500"
        />
      </div>
    </div>
  );
}
