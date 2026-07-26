"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileSearch,
  FileVideo,
  Trash2,
} from "lucide-react";
import { evidenceTypeLabels } from "@/domain";
import { addFiaEvidenceAction } from "@/lib/fia/actions";
import {
  initialFiaActionState,
  type FiaTicketDetail,
} from "@/lib/fia/types";
import type { VideoUploadLimits } from "@/lib/storage/evidence-types";
import ActionMessage from "./ActionMessage";
import VideoEvidenceUploader from "./VideoEvidenceUploader";

type EvidenceCardProps = {
  ticketId: number;
  evidence: FiaTicketDetail["evidence"];
  canAddEvidence: boolean;
  uploadLimits: VideoUploadLimits;
};

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "unit",
    unit: bytes >= 1024 * 1024 ? "megabyte" : "kilobyte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(bytes / (bytes >= 1024 * 1024 ? 1024 * 1024 : 1024));
}

export default function EvidenceCard({
  ticketId,
  evidence,
  canAddEvidence,
  uploadLimits,
}: EvidenceCardProps) {
  const router = useRouter();
  const action = addFiaEvidenceAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(
    action,
    initialFiaActionState,
  );
  const [removalPending, startRemovalTransition] = useTransition();
  const [removalError, setRemovalError] = useState("");
  const uploadedFileCount = evidence.filter(
    (item) => item.storagePath !== null,
  ).length;

  function removeEvidence(evidenceId: number): void {
    setRemovalError("");
    startRemovalTransition(async () => {
      const response = await fetch(`/api/fia/evidence/${evidenceId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setRemovalError("Der Beweis konnte nicht entfernt werden.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <FileSearch className="text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-white">
          Beweise ({evidence.length})
        </h2>
      </div>

      <div className="mt-5 space-y-3">
        {evidence.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 transition hover:border-blue-500"
          >
            {item.storagePath ? (
              <FileVideo
                size={19}
                className="mt-0.5 shrink-0 text-blue-400"
              />
            ) : null}
            {item.viewUrl ? (
              <a
                href={item.viewUrl}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1"
              >
                <p className="truncate font-semibold text-white">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {item.originalFilename ?? evidenceTypeLabels[item.type]}
                  {item.fileSize ? ` · ${formatBytes(item.fileSize)}` : ""}
                  {" · "}
                  {item.submittedBy?.displayName ?? "System"}
                </p>
              </a>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Beweis nicht verfügbar
                </p>
              </div>
            )}
            {item.viewUrl ? (
              <ExternalLink size={17} className="shrink-0 text-blue-400" />
            ) : null}
            {canAddEvidence ? (
              <button
                type="button"
                disabled={removalPending}
                onClick={() => removeEvidence(item.id)}
                aria-label={`${item.label} entfernen`}
                className="min-h-10 min-w-10 rounded-lg p-2 text-red-300 transition hover:bg-red-500/10"
              >
                <Trash2 size={17} />
              </button>
            ) : null}
          </div>
        ))}
        {evidence.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            Noch keine Beweise hinterlegt.
          </p>
        ) : null}
        {removalError ? (
          <p role="alert" className="text-sm text-red-300">
            {removalError}
          </p>
        ) : null}
      </div>

      {canAddEvidence ? (
        <div className="mt-7 space-y-7 border-t border-slate-800 pt-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-white">Video hochladen</h3>
            <VideoEvidenceUploader
              limits={uploadLimits}
              uploads={[]}
              existingFileCount={uploadedFileCount}
              onUploadsChange={() => undefined}
              ticketId={ticketId}
            />
          </div>

          <form action={formAction} className="space-y-3 border-t border-slate-800 pt-6">
            <h3 className="font-semibold text-white">
              Externen Link ergänzen
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="label"
                required
                maxLength={160}
                placeholder="Bezeichnung"
                className="form-control min-h-12"
              />
              <input
                name="url"
                type="url"
                required
                placeholder="https://…"
                className="form-control min-h-12"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ActionMessage state={state} />
              <button
                type="submit"
                disabled={pending}
                className="wizard-primary-button min-h-12 w-full justify-center sm:w-auto"
              >
                {pending ? "Speichert…" : "Link speichern"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
