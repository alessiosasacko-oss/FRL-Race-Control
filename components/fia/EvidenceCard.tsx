"use client";

import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
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

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  const sectionRef = useRef<HTMLElement>(null);
  const linkLabelRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);
  const uploadedFileCount = evidence.filter(
    (item) => item.isStoredVideo,
  ).length;

  useEffect(() => {
    function handleEvidenceAction(event: Event): void {
      const action = (
        event as CustomEvent<{
          action?: "file" | "image" | "video" | "external";
        }>
      ).detail?.action;
      if (!action) return;
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      if (action === "image" || action === "external") {
        window.setTimeout(() => {
          if (
            action === "image" &&
            linkLabelRef.current &&
            !linkLabelRef.current.value
          ) {
            linkLabelRef.current.value = "Bildbeweis";
          }
          linkUrlRef.current?.focus();
        }, 300);
      }
    }
    window.addEventListener(
      "frl-evidence-action",
      handleEvidenceAction,
    );
    return () =>
      window.removeEventListener(
        "frl-evidence-action",
        handleEvidenceAction,
      );
  }, []);

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
    <section
      ref={sectionRef}
      id="fia-evidence"
      className="surface-panel scroll-mt-24 rounded-[1.25rem] border-[color-mix(in_srgb,var(--page-accent)_20%,transparent)] p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <FileSearch className="text-cyan-400" size={20} />
        <h2 className="text-xl font-bold text-white">
          Beweise ({evidence.length})
        </h2>
      </div>

      <div className="mt-5 space-y-3">
        {evidence.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 transition hover:border-cyan-500"
          >
            <div className="flex items-start gap-3">
              {item.isStoredVideo ? (
                <FileVideo
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-400"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {item.originalFilename ?? evidenceTypeLabels[item.type]}
                  {item.fileSize
                    ? ` · ${formatBytes(item.fileSize)}`
                    : ""}
                  {" · "}
                  {item.submittedBy?.displayName ?? "System"}
                  {" · "}
                  {formatTimestamp(item.createdAt)}
                </p>
              </div>
              {item.viewUrl ? (
                <a
                  href={item.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${item.label} in neuem Tab öffnen`}
                  className="grid min-h-10 min-w-10 place-items-center rounded-lg text-blue-400 transition hover:bg-blue-500/10"
                >
                  <ExternalLink size={17} />
                </a>
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

            {item.isStoredVideo && item.viewUrl ? (
              <video
                controls
                preload="metadata"
                src={item.viewUrl}
                className="mt-4 aspect-video w-full rounded-lg bg-black object-contain"
              >
                Dein Browser unterstützt die Videowiedergabe nicht.
              </video>
            ) : null}
            {!item.isStoredVideo && item.viewUrl ? (
              <a
                href={item.viewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-500/30 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
              >
                <ExternalLink size={16} />
                Externen Beweis öffnen
              </a>
            ) : null}
            {!item.viewUrl ? (
              <p className="mt-3 text-sm text-amber-300">
                Beweis nicht verfügbar.
              </p>
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
                ref={linkLabelRef}
                name="label"
                required
                maxLength={160}
                placeholder="Bezeichnung"
                className="form-control min-h-12"
              />
              <input
                ref={linkUrlRef}
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
