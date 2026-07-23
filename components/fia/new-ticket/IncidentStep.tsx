"use client";

import { AlertTriangle, ClipboardList } from "lucide-react";
import {
  RaceSession,
  TicketPriority,
  ticketPriorityLabels,
} from "@/domain";
import type { TicketWizardDraft } from "./wizard-types";

type IncidentStepProps = {
  data: TicketWizardDraft;
  setData: React.Dispatch<React.SetStateAction<TicketWizardDraft>>;
};

export default function IncidentStep({
  data,
  setData,
}: IncidentStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <ClipboardList className="text-blue-400" />
          <h2 className="text-3xl font-bold text-white">Vorfall</h2>
        </div>
        <p className="mt-2 text-slate-400">
          Dokumentiere den Vorfall so präzise wie möglich.
        </p>
      </div>

      <label className="block text-sm font-medium text-slate-300">
        Titel
        <input
          value={data.title}
          onChange={(event) =>
            setData((previous) => ({
              ...previous,
              title: event.target.value,
            }))
          }
          maxLength={160}
          placeholder="Kontakt zwischen Car 7 und Car 18"
          className="form-control mt-2"
        />
      </label>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-300">
          Runde
          <input
            type="number"
            min={1}
            max={999}
            value={data.lap}
            onChange={(event) =>
              setData((previous) => ({
                ...previous,
                lap: event.target.value,
              }))
            }
            placeholder={data.session === RaceSession.Race ? "12" : "Optional"}
            className="form-control mt-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Kurve / Abschnitt
          <input
            value={data.corner}
            onChange={(event) =>
              setData((previous) => ({
                ...previous,
                corner: event.target.value,
              }))
            }
            maxLength={80}
            placeholder="Turn 4"
            className="form-control mt-2"
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-slate-300">
          Priorität
        </legend>
        <div className="flex flex-wrap gap-3">
          {Object.values(TicketPriority).map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() =>
                setData((previous) => ({ ...previous, priority }))
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
      </fieldset>

      <label className="block text-sm font-medium text-slate-300">
        Beschreibung
        <textarea
          rows={8}
          value={data.description}
          onChange={(event) =>
            setData((previous) => ({
              ...previous,
              description: event.target.value,
            }))
          }
          maxLength={5000}
          placeholder="Beschreibe Ablauf, Positionen und Folgen..."
          className="form-control mt-2"
        />
      </label>
    </div>
  );
}
