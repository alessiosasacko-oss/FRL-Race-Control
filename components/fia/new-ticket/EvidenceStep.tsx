"use client";

import { Link2, Plus, Trash2 } from "lucide-react";
import VideoEvidenceUploader from "@/components/fia/VideoEvidenceUploader";
import type { TicketWizardOptions } from "@/lib/fia/types";
import type { UploadedVideoMetadata } from "@/lib/storage/evidence-types";
import type {
  ExternalEvidenceDraft,
  TicketWizardDraft,
} from "./wizard-types";

type EvidenceStepProps = {
  data: TicketWizardDraft;
  options: Pick<TicketWizardOptions, "uploadLimits">;
  setData: React.Dispatch<React.SetStateAction<TicketWizardDraft>>;
};

export default function EvidenceStep({
  data,
  options,
  setData,
}: EvidenceStepProps) {
  const links = data.evidence.filter(
    (evidence): evidence is ExternalEvidenceDraft =>
      evidence.kind === "external",
  );
  const uploads = data.evidence.filter(
    (evidence): evidence is UploadedVideoMetadata =>
      evidence.kind === "upload",
  );

  function addEvidenceLink(): void {
    setData((previous) => ({
      ...previous,
      evidence: [
        ...previous.evidence,
        {
          kind: "external",
          key: crypto.randomUUID(),
          url: "",
          label: "",
        },
      ],
    }));
  }

  function updateEvidenceLink(
    key: string,
    field: "url" | "label",
    value: string,
  ): void {
    setData((previous) => ({
      ...previous,
      evidence: previous.evidence.map((evidence) =>
        evidence.kind === "external" && evidence.key === key
          ? { ...evidence, [field]: value }
          : evidence,
      ),
    }));
  }

  function removeEvidenceLink(key: string): void {
    setData((previous) => ({
      ...previous,
      evidence: previous.evidence.filter(
        (evidence) =>
          evidence.kind !== "external" || evidence.key !== key,
      ),
    }));
  }

  function updateUploads(nextUploads: UploadedVideoMetadata[]): void {
    setData((previous) => ({
      ...previous,
      evidence: [
        ...previous.evidence.filter(
          (evidence) => evidence.kind === "external",
        ),
        ...nextUploads,
      ],
    }));
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <Link2 className="text-blue-400" />
          <h2 className="text-3xl font-bold text-white">Beweise</h2>
        </div>
        <p className="mt-2 text-slate-400">
          Lade Videos direkt hoch oder ergänze optionale externe Links.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Video-Dateien</h3>
          <p className="mt-1 text-sm text-slate-400">
            Auf Mobilgeräten kannst du ein vorhandenes Video auswählen oder
            direkt eine Aufnahme starten.
          </p>
        </div>
        <VideoEvidenceUploader
          limits={options.uploadLimits}
          uploads={uploads}
          onUploadsChange={updateUploads}
        />
      </section>

      <section className="space-y-4 border-t border-slate-800 pt-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Externe Links</h3>
            <p className="mt-1 text-sm text-slate-400">
              Zum Beispiel Replay-, Cloud- oder Stream-Links.
            </p>
          </div>
          <button
            type="button"
            onClick={addEvidenceLink}
            disabled={links.length >= 10}
            className="wizard-secondary-button min-h-12 w-full justify-center sm:w-auto"
          >
            <Plus size={18} /> Link hinzufügen
          </button>
        </div>

        <div className="space-y-4">
          {links.map((evidence, index) => (
            <div
              key={evidence.key}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-semibold text-white">
                  Link {index + 1}
                </h4>
                <button
                  type="button"
                  onClick={() => removeEvidenceLink(evidence.key)}
                  aria-label={`Link ${index + 1} entfernen`}
                  className="min-h-11 min-w-11 rounded-lg p-2 text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={evidence.label}
                  maxLength={160}
                  onChange={(event) =>
                    updateEvidenceLink(
                      evidence.key,
                      "label",
                      event.target.value,
                    )
                  }
                  placeholder="Bezeichnung"
                  className="form-control min-h-12"
                />
                <input
                  type="url"
                  value={evidence.url}
                  onChange={(event) =>
                    updateEvidenceLink(
                      evidence.key,
                      "url",
                      event.target.value,
                    )
                  }
                  placeholder="https://…"
                  className="form-control min-h-12"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.evidence.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
          Beweise sind optional und können später ergänzt werden.
        </div>
      ) : null}
    </div>
  );
}
