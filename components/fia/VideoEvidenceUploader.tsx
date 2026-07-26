"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  FileVideo,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  UploadedVideoMetadata,
  VideoUploadLimits,
} from "@/lib/storage/evidence-types";

type VideoEvidenceUploaderProps = {
  limits: VideoUploadLimits;
  uploads: UploadedVideoMetadata[];
  onUploadsChange: (uploads: UploadedVideoMetadata[]) => void;
  ticketId?: number;
  existingFileCount?: number;
};

type UploadPreparation = {
  signedUrl: string;
  storagePath: string;
};

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "unit",
    unit: bytes >= 1024 * 1024 ? "megabyte" : "kilobyte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(bytes / (bytes >= 1024 * 1024 ? 1024 * 1024 : 1024));
}

function defaultLabel(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").slice(0, 160);
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Der Upload ist fehlgeschlagen.");
  }
  return body;
}

function uploadFile(
  signedUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("x-upsert", "false");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("Die Datei konnte nicht übertragen werden."));
      }
    });
    request.addEventListener("error", () =>
      reject(new Error("Die Netzwerkverbindung wurde unterbrochen.")),
    );

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    request.send(body);
  });
}

export default function VideoEvidenceUploader({
  limits,
  uploads,
  onUploadsChange,
  ticketId,
  existingFileCount = 0,
}: VideoEvidenceUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const atLimit = existingFileCount + uploads.length >= limits.maxFiles;

  function selectFile(selectedFile: File | undefined): void {
    if (!selectedFile) return;
    const mimeType = selectedFile.type.toLowerCase();

    if (!limits.allowedMimeTypes.includes(mimeType)) {
      setStatus("error");
      setMessage("Bitte wähle eine MP4-, MOV- oder WebM-Datei.");
      return;
    }
    if (selectedFile.size > limits.maxFileSizeBytes) {
      setStatus("error");
      setMessage(
        `Das Video darf höchstens ${formatBytes(limits.maxFileSizeBytes)} groß sein.`,
      );
      return;
    }

    setFile(selectedFile);
    setLabel(defaultLabel(selectedFile.name));
    setProgress(0);
    setStatus("idle");
    setMessage("");
  }

  async function startUpload(): Promise<void> {
    if (!file || !label.trim() || atLimit || !limits.enabled) return;
    setStatus("uploading");
    setMessage("");
    setProgress(0);
    let storagePath: string | undefined;

    try {
      const preparation = await jsonResponse<UploadPreparation>(
        await fetch("/api/fia/evidence/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalFilename: file.name,
            mimeType: file.type,
            fileSize: file.size,
          }),
        }),
      );
      storagePath = preparation.storagePath;
      await uploadFile(preparation.signedUrl, file, setProgress);

      const completed = await jsonResponse<{
        upload: UploadedVideoMetadata;
        evidenceId?: number;
      }>(
        await fetch("/api/fia/evidence/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId,
            upload: {
              kind: "upload",
              storagePath: preparation.storagePath,
              originalFilename: file.name,
              mimeType: file.type,
              fileSize: file.size,
              label: label.trim(),
            },
          }),
        }),
      );

      if (ticketId === undefined) {
        onUploadsChange([...uploads, completed.upload]);
      } else {
        router.refresh();
      }
      setFile(null);
      setLabel("");
      setStatus("success");
      setMessage("Video sicher hochgeladen.");
    } catch (error: unknown) {
      if (storagePath) {
        await fetch("/api/fia/evidence/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        }).catch(() => undefined);
      }
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Video konnte nicht hochgeladen werden.",
      );
    }
  }

  async function removeUpload(storagePath: string): Promise<boolean> {
    setMessage("");
    const response = await fetch("/api/fia/evidence/uploads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setStatus("error");
      setMessage(body.error ?? "Das Video konnte nicht entfernt werden.");
      return false;
    }
    onUploadsChange(
      uploads.filter((upload) => upload.storagePath !== storagePath),
    );
    return true;
  }

  async function replaceUpload(storagePath: string): Promise<void> {
    if (await removeUpload(storagePath)) {
      fileInputRef.current?.click();
    }
  }

  if (!limits.enabled) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Direkte Video-Uploads sind noch nicht konfiguriert. Externe
        Beweislinks können weiterhin verwendet werden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={atLimit || status === "uploading"}
          onClick={() => fileInputRef.current?.click()}
          className="wizard-secondary-button min-h-12 w-full justify-center"
        >
          <FileVideo size={19} /> Video auswählen
        </button>
        <button
          type="button"
          disabled={atLimit || status === "uploading"}
          onClick={() => cameraInputRef.current?.click()}
          className="wizard-secondary-button min-h-12 w-full justify-center"
        >
          <Camera size={19} /> Video aufnehmen
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={limits.allowedMimeTypes.join(",")}
        className="sr-only"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={limits.allowedMimeTypes.join(",")}
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <p className="text-xs leading-5 text-slate-400">
        MP4, MOV oder WebM · maximal {formatBytes(limits.maxFileSizeBytes)} ·{" "}
        höchstens {limits.maxFiles} Dateien pro Ticket
      </p>

      {file ? (
        <div className="space-y-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <FileVideo className="mt-0.5 shrink-0 text-blue-400" size={20} />
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{file.name}</p>
              <p className="text-sm text-slate-400">
                {formatBytes(file.size)}
              </p>
            </div>
          </div>
          <label className="block text-sm font-medium text-slate-300">
            Bezeichnung
            <input
              value={label}
              maxLength={160}
              onChange={(event) => setLabel(event.target.value)}
              className="form-control mt-2"
              placeholder="Onboard-Aufnahme"
            />
          </label>
          {status === "uploading" ? (
            <div>
              <div className="mb-2 flex justify-between text-sm text-slate-300">
                <span>Upload läuft…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={status === "uploading" || !label.trim()}
              onClick={() => void startUpload()}
              className="wizard-primary-button min-h-12 flex-1 justify-center"
            >
              <Upload size={18} /> Video hochladen
            </button>
            <button
              type="button"
              disabled={status === "uploading"}
              onClick={() => {
                setFile(null);
                setProgress(0);
                setStatus("idle");
              }}
              className="wizard-secondary-button min-h-12 justify-center"
            >
              <Trash2 size={18} /> Auswahl entfernen
            </button>
          </div>
        </div>
      ) : null}

      {uploads.map((upload) => (
        <div
          key={upload.storagePath}
          className="flex flex-col gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-4 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <CheckCircle2
              className="mt-0.5 shrink-0 text-green-400"
              size={20}
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-white">
                {upload.originalFilename}
              </p>
              <p className="text-sm text-slate-400">
                {formatBytes(upload.fileSize)} · Upload erfolgreich
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void replaceUpload(upload.storagePath)}
              className="wizard-secondary-button min-h-11 flex-1 justify-center px-3 sm:flex-none"
            >
              <RefreshCcw size={16} /> Ersetzen
            </button>
            <button
              type="button"
              onClick={() => void removeUpload(upload.storagePath)}
              className="wizard-secondary-button min-h-11 flex-1 justify-center px-3 text-red-200 sm:flex-none"
            >
              <Trash2 size={16} /> Entfernen
            </button>
          </div>
        </div>
      ))}

      {message ? (
        <p
          role="status"
          className={
            status === "error" ? "text-sm text-red-300" : "text-sm text-green-300"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
