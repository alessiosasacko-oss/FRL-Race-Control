"use client";

import { Link2, Plus, Trash2 } from "lucide-react";
import {
  EvidenceType,
  evidenceTypeLabels,
} from "@/domain";
import type { TicketWizardDraft } from "./wizard-types";

type EvidenceStepProps = {
  data: TicketWizardDraft;
  setData: React.Dispatch<React.SetStateAction<TicketWizardDraft>>;
};

export default function EvidenceStep({
  data,
  setData,
}: EvidenceStepProps) {
  function addEvidence(): void {
    setData((previous) => ({
      ...previous,
      evidence: [
        ...previous.evidence,
        {
          key: crypto.randomUUID(),
          type: EvidenceType.Link,
          url: "",
          label: "",
        },
      ],
    }));
  }

  function updateEvidence(
    key: string,
    field: "type" | "url" | "label",
    value: string,
  ): void {
    setData((previous) => ({
      ...previous,
      evidence: previous.evidence.map((evidence) =>
        evidence.key === key
          ? {
              ...evidence,
              [field]:
                field === "type" ? (value as EvidenceType) : value,
            }
          : evidence,
      ),
    }));
  }

  function removeEvidence(key: string): void {
    setData((previous) => ({
      ...previous,
      evidence: previous.evidence.filter(
        (evidence) => evidence.key !== key,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Link2 className="text-blue-400" />
          <h2 className="text-3xl font-bold text-white">
            Beweismetadaten
          </h2>
        </div>
        <p className="mt-2 text-slate-400">
          Hinterlege Links zu Replays, Bildern oder Dokumenten. Die Dateien
          selbst werden in dieser Phase nicht hochgeladen.
        </p>
      </div>

      <button
        type="button"
        onClick={addEvidence}
        disabled={data.evidence.length >= 10}
        className="wizard-primary-button"
      >
        <Plus size={18} /> Beweis hinzufügen
      </button>

      <div className="space-y-4">
        {data.evidence.map((evidence, index) => (
          <div
            key={evidence.key}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">
                Beweis {index + 1}
              </h3>
              <button
                type="button"
                onClick={() => removeEvidence(evidence.key)}
                aria-label={`Beweis ${index + 1} entfernen`}
                className="rounded-lg p-2 text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <select
                value={evidence.type}
                onChange={(event) =>
                  updateEvidence(evidence.key, "type", event.target.value)
                }
                className="form-control"
              >
                {Object.values(EvidenceType).map((type) => (
                  <option key={type} value={type}>
                    {evidenceTypeLabels[type]}
                  </option>
                ))}
              </select>
              <input
                value={evidence.label}
                onChange={(event) =>
                  updateEvidence(evidence.key, "label", event.target.value)
                }
                placeholder="Bezeichnung"
                className="form-control"
              />
              <input
                type="url"
                value={evidence.url}
                onChange={(event) =>
                  updateEvidence(evidence.key, "url", event.target.value)
                }
                placeholder="https://…"
                className="form-control"
              />
            </div>
          </div>
        ))}
      </div>

      {data.evidence.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
          Beweise sind optional und können später ergänzt werden.
        </div>
      ) : null}
    </div>
  );
}
