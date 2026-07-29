"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  FileVideo,
  RefreshCcw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import type {
  UploadedVideoMetadata,
  VideoUploadCompletion,
  VideoUploadLimits,
  VideoUploadPreparation,
  VideoUploadStage,
} from "@/lib/storage/evidence-types";
import {
  FIA_VIDEO_ACCEPT,
  validateVideoMetadata,
} from "@/lib/storage/evidence-constants";
import {
  videoUploadCompletionSchema,
  videoUploadPreparationSchema,
} from "@/lib/storage/evidence-schemas";
import {
  parseUploadResponse,
  videoUploadRetryPlan,
} from "@/lib/storage/evidence-upload-client";

type VideoEvidenceUploaderProps = {
  limits: VideoUploadLimits;
  uploads: UploadedVideoMetadata[];
  onUploadsChange: (uploads: UploadedVideoMetadata[]) => void;
  ticketId?: number;
  submissionKey?: string;
  existingFileCount?: number;
};

export type VideoEvidenceUploaderHandle = {
  hasPendingFiles: () => boolean;
  uploadPending: () => Promise<UploadBatchResult>;
};

export type UploadBatchResult = {
  success: boolean;
  uploads: UploadedVideoMetadata[];
};

type QueuedVideo = {
  key: string;
  file: File;
  label: string;
  progress: number;
  status: VideoUploadStage;
  message: string;
  temporaryUploadId?: string;
  storagePath?: string;
  storageUploaded: boolean;
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
        reject(
          new Error("Die Datei konnte nicht übertragen werden."),
        );
      }
    });
    request.addEventListener("error", () =>
      reject(
        new Error("Die Netzwerkverbindung wurde unterbrochen."),
      ),
    );

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    request.send(body);
  });
}

const VideoEvidenceUploader = forwardRef<
  VideoEvidenceUploaderHandle,
  VideoEvidenceUploaderProps
>(function VideoEvidenceUploader(
  {
    limits,
    uploads,
    onUploadsChange,
    ticketId,
    submissionKey,
    existingFileCount = 0,
  },
  ref,
) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const replacementKeyRef = useRef<string | null>(null);
  const [queue, setQueue] = useState<QueuedVideo[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const totalCount =
    existingFileCount + uploads.length + queue.length;
  const atLimit = totalCount >= limits.maxFiles;

  useEffect(() => {
    function handleEvidenceAction(event: Event): void {
      const action = (
        event as CustomEvent<{
          action?: "file" | "image" | "video" | "external";
        }>
      ).detail?.action;
      if (action === "file" || action === "video") {
        fileInputRef.current?.click();
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

  useEffect(() => {
    if (!uploading && queue.length === 0) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () =>
      window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [queue.length, uploading]);

  function updateQueued(
    key: string,
    patch: Partial<QueuedVideo>,
  ): void {
    setQueue((current) =>
      current.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    );
  }

  function validateFile(file: File): string | null {
    const error = validateVideoMetadata(
      file.type,
      file.size,
      limits.maxFileSizeBytes,
      limits.allowedMimeTypes,
    );
    if (error === "UNSUPPORTED_VIDEO_TYPE") {
      return `${file.name}: Dieses Videoformat wird nicht unterstützt.`;
    }
    if (error === "VIDEO_TOO_LARGE") {
      return `${file.name}: Die Videodatei ist zu groß. Maximal ${formatBytes(
        limits.maxFileSizeBytes,
      )}.`;
    }
    return error ? `${file.name}: Die Videodatei ist ungültig.` : null;
  }

  function acceptFiles(fileList: FileList | readonly File[]): void {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const replacementKey = replacementKeyRef.current;
    replacementKeyRef.current = null;

    if (replacementKey) {
      const replacement = files[0];
      const error = validateFile(replacement);
      if (error) {
        setMessage(error);
        return;
      }
      updateQueued(replacementKey, {
        file: replacement,
        label: defaultLabel(replacement.name),
        progress: 0,
        status: "selected",
        message: "",
        temporaryUploadId: undefined,
        storagePath: undefined,
        storageUploaded: false,
      });
      setMessage("");
      return;
    }

    const available =
      limits.maxFiles -
      existingFileCount -
      uploads.length -
      queue.length;
    if (available <= 0) {
      setMessage(
        `Es sind höchstens ${limits.maxFiles} Videos pro Ticket erlaubt.`,
      );
      return;
    }

    const accepted: QueuedVideo[] = [];
    const errors: string[] = [];
    for (const file of files.slice(0, available)) {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        accepted.push({
          key: crypto.randomUUID(),
          file,
          label: defaultLabel(file.name),
          progress: 0,
          status: "selected",
          message: "",
          storageUploaded: false,
        });
      }
    }
    if (files.length > available) {
      errors.push(
        `Nur ${available} weitere ${
          available === 1 ? "Datei" : "Dateien"
        } möglich.`,
      );
    }
    setQueue((current) => [...current, ...accepted]);
    setMessage(errors.join(" "));
  }

  async function uploadQueued(
    item: QueuedVideo,
  ): Promise<UploadedVideoMetadata | null> {
    let preparation: VideoUploadPreparation | undefined =
      item.temporaryUploadId && item.storagePath
        ? {
            temporaryUploadId: item.temporaryUploadId,
            storagePath: item.storagePath,
            signedUrl: "",
          }
        : undefined;
    let storageUploaded = item.storageUploaded;

    try {
      if (
        videoUploadRetryPlan(storageUploaded) ===
          "prepare-and-upload" &&
        !preparation
      ) {
        updateQueued(item.key, {
          status: "preparing",
          progress: 0,
          message: "Upload wird vorbereitet …",
        });
        preparation = await parseUploadResponse(
          await fetch("/api/fia/evidence/uploads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalFilename: item.file.name,
              mimeType: item.file.type,
              fileSize: item.file.size,
              ticketId,
              submissionKey,
            }),
          }),
          videoUploadPreparationSchema,
        );
        updateQueued(item.key, {
          temporaryUploadId: preparation.temporaryUploadId,
          storagePath: preparation.storagePath,
        });
      }
      if (!preparation) {
        throw new Error("Der Upload konnte nicht vorbereitet werden.");
      }

      if (!storageUploaded) {
        updateQueued(item.key, {
          status: "uploading",
          progress: 0,
          message: "Video wird hochgeladen …",
        });
        await uploadFile(preparation.signedUrl, item.file, (progress) =>
          updateQueued(item.key, {
            progress: Math.min(progress, 99),
          }),
        );
        storageUploaded = true;
        updateQueued(item.key, {
          storageUploaded: true,
          progress: 100,
        });
      }

      updateQueued(item.key, {
        status: "finalizing",
        progress: 100,
        message: "Video wird verarbeitet und verknüpft …",
      });
      const completed = await parseUploadResponse<VideoUploadCompletion>(
        await fetch("/api/fia/evidence/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temporaryUploadId: preparation.temporaryUploadId,
            storagePath: preparation.storagePath,
            label: item.label.trim(),
          }),
        }),
        videoUploadCompletionSchema,
      );
      updateQueued(item.key, {
        status: "completed",
        progress: 100,
        message: "Video erfolgreich hochgeladen",
      });
      return completed.upload;
    } catch (error: unknown) {
      if (!storageUploaded && preparation?.storagePath) {
        await fetch("/api/fia/evidence/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temporaryUploadId: preparation.temporaryUploadId,
            storagePath: preparation.storagePath,
          }),
        }).catch(() => undefined);
      }
      updateQueued(item.key, {
        status: "failed",
        temporaryUploadId: storageUploaded
          ? preparation?.temporaryUploadId
          : undefined,
        storagePath: storageUploaded
          ? preparation?.storagePath
          : undefined,
        storageUploaded,
        message:
          error instanceof Error
            ? error.message
            : storageUploaded
              ? "Das Video wurde hochgeladen, konnte aber noch nicht mit dem Ticket verknüpft werden. Versuche die Verknüpfung erneut."
              : "Der Storage-Upload ist fehlgeschlagen.",
      });
      return null;
    }
  }

  async function startUploads(): Promise<UploadBatchResult> {
    const pending = queue.filter(
      (item) =>
        item.status !== "completed" && item.label.trim().length > 0,
    );
    if (pending.length === 0) {
      return { success: true, uploads };
    }
    if (uploading) {
      return { success: false, uploads };
    }
    setUploading(true);
    setMessage("");
    const completed: UploadedVideoMetadata[] = [];

    for (const item of pending) {
      const upload = await uploadQueued(item);
      if (upload) completed.push(upload);
    }

    const nextUploads = [...uploads, ...completed];
    if (ticketId === undefined && completed.length > 0) {
      onUploadsChange(nextUploads);
    } else if (completed.length > 0) {
      router.refresh();
    }
    setQueue((current) =>
      current.filter((item) => item.status !== "completed"),
    );
    setUploading(false);
    setMessage(
      completed.length === pending.length
        ? "Alle Videos wurden sicher hochgeladen."
        : "Mindestens ein Video konnte nicht hochgeladen werden.",
    );
    return {
      success: completed.length === pending.length,
      uploads: ticketId === undefined ? nextUploads : uploads,
    };
  }

  useImperativeHandle(ref, () => ({
    hasPendingFiles: () =>
      queue.some((item) => item.status !== "completed"),
    uploadPending: startUploads,
  }));

  async function removeUpload(
    storagePath: string,
    temporaryUploadId?: string,
  ): Promise<boolean> {
    setMessage("");
    const response = await fetch("/api/fia/evidence/uploads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath, temporaryUploadId }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setMessage(
        body.error ?? "Das Video konnte nicht entfernt werden.",
      );
      return false;
    }
    onUploadsChange(
      uploads.filter(
        (upload) => upload.storagePath !== storagePath,
      ),
    );
    return true;
  }

  async function replaceUpload(storagePath: string): Promise<void> {
    if (await removeUpload(storagePath)) {
      fileInputRef.current?.click();
    }
  }

  async function discardQueuedItem(item: QueuedVideo): Promise<void> {
    if (item.storagePath) {
      const removed = await removeUpload(
        item.storagePath,
        item.temporaryUploadId,
      );
      if (!removed) return;
    }
    setQueue((current) =>
      current.filter((candidate) => candidate.key !== item.key),
    );
  }

  async function prepareQueuedReplacement(
    item: QueuedVideo,
  ): Promise<void> {
    if (item.storagePath) {
      const removed = await removeUpload(
        item.storagePath,
        item.temporaryUploadId,
      );
      if (!removed) return;
    }
    updateQueued(item.key, {
      temporaryUploadId: undefined,
      storagePath: undefined,
      storageUploaded: false,
      progress: 0,
      status: "selected",
      message: "",
    });
    replacementKeyRef.current = item.key;
    fileInputRef.current?.click();
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
    <div
      className="space-y-4"
      onPaste={(event) => {
        const files = event.clipboardData.files;
        if (files.length > 0) {
          event.preventDefault();
          acceptFiles(files);
        }
      }}
    >
      <div
        role="button"
        tabIndex={atLimit || uploading ? -1 : 0}
        aria-disabled={atLimit || uploading}
        onClick={() => {
          if (!atLimit && !uploading) fileInputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (
            !atLimit &&
            !uploading &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!atLimit) setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (!atLimit && !uploading) {
            acceptFiles(event.dataTransfer.files);
          }
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-10 ${
          dragActive
            ? "border-blue-400 bg-blue-500/15"
            : "border-slate-700 bg-slate-950/35 hover:border-blue-500/60 hover:bg-blue-500/5"
        } ${atLimit || uploading ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <Upload className="mx-auto text-blue-400" size={34} />
        <p className="mt-3 font-semibold text-white">
          Videos hier ablegen oder einfügen
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Drag-and-drop, Zwischenablage oder Dateiauswahl
        </p>
        <span className="wizard-secondary-button mt-4 inline-flex min-h-12 w-full justify-center sm:w-auto">
          <FileVideo size={19} /> Videodatei auswählen
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={atLimit || uploading}
          onClick={() => fileInputRef.current?.click()}
          className="wizard-secondary-button min-h-12 w-full justify-center"
        >
          <FileVideo size={19} /> Dateien auswählen
        </button>
        <button
          type="button"
          disabled={atLimit || uploading}
          onClick={() => cameraInputRef.current?.click()}
          className="wizard-secondary-button min-h-12 w-full justify-center"
        >
          <Camera size={19} /> Neues Video aufnehmen
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FIA_VIDEO_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) acceptFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={FIA_VIDEO_ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) acceptFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <p className="text-xs leading-5 text-slate-400">
        MP4, MOV oder WebM · maximal{" "}
        {formatBytes(limits.maxFileSizeBytes)} · höchstens{" "}
        {limits.maxFiles} Dateien pro Ticket. Die normale Dateiauswahl
        öffnet auf Mobilgeräten Galerie und Dateien; die Kamera ist
        optional.
      </p>

      {queue.map((item) => (
        <div
          key={item.key}
          className={`space-y-4 rounded-2xl border p-4 ${
            item.status === "failed"
              ? "border-red-500/35 bg-red-500/5"
              : item.status === "completed"
                ? "border-green-500/35 bg-green-500/5"
                : "border-blue-500/30 bg-blue-500/5"
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            {item.status === "failed" ? (
              <XCircle
                className="mt-0.5 shrink-0 text-red-400"
                size={21}
              />
            ) : item.status === "completed" ? (
              <CheckCircle2
                className="mt-0.5 shrink-0 text-green-400"
                size={21}
              />
            ) : (
              <FileVideo
                className="mt-0.5 shrink-0 text-blue-400"
                size={21}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">
                {item.file.name}
              </p>
              <p className="text-sm text-slate-400">
                {formatBytes(item.file.size)} ·{" "}
                {item.file.type || "Unbekannter Dateityp"}
              </p>
              {item.message ? (
                <p
                  className={`mt-1 text-sm ${
                    item.status === "failed"
                      ? "text-red-300"
                      : "text-green-300"
                  }`}
                >
                  {item.message}
                </p>
              ) : null}
            </div>
          </div>
          <label className="block text-sm font-medium text-slate-300">
            Bezeichnung
            <input
              value={item.label}
              maxLength={160}
              disabled={
                item.status === "preparing" ||
                item.status === "uploading" ||
                item.status === "finalizing"
              }
              onChange={(event) =>
                updateQueued(item.key, {
                  label: event.target.value,
                })
              }
              className="form-control mt-2 min-h-12"
              placeholder="Onboard-Aufnahme"
            />
          </label>
          {item.status === "uploading" ||
          item.status === "finalizing" ||
          item.progress > 0 ? (
            <div>
              <div className="mb-2 flex justify-between text-sm text-slate-300">
                <span>
                  {item.status === "completed"
                    ? "Video erfolgreich hochgeladen"
                    : item.status === "finalizing"
                      ? "Video wird verarbeitet und verknüpft …"
                      : "Video wird hochgeladen …"}
                </span>
                <span>{item.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width]"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ) : null}
          {item.status === "failed" && item.storageUploaded ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => void startUploads()}
              className="wizard-primary-button min-h-12 w-full justify-center"
            >
              <RefreshCcw size={17} /> Verknüpfung erneut versuchen
            </button>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => void prepareQueuedReplacement(item)}
              className="wizard-secondary-button min-h-12 justify-center"
            >
              <RefreshCcw size={17} /> Datei ersetzen
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => void discardQueuedItem(item)}
              className="wizard-secondary-button min-h-12 justify-center text-red-200"
            >
              <Trash2 size={17} /> Auswahl entfernen
            </button>
          </div>
        </div>
      ))}

      {queue.length > 0 ? (
        <button
          type="button"
          disabled={
            uploading ||
            queue.some((item) => !item.label.trim())
          }
          onClick={() => void startUploads()}
          className="wizard-primary-button min-h-12 w-full justify-center"
        >
          <Upload size={18} />
          {uploading
            ? "Videos werden hochgeladen…"
            : `${queue.length} ${
                queue.length === 1 ? "Video" : "Videos"
              } hochladen`}
        </button>
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
                {formatBytes(upload.fileSize)} · {upload.mimeType} ·
                Upload erfolgreich
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() =>
                void replaceUpload(upload.storagePath)
              }
              className="wizard-secondary-button min-h-11 justify-center px-3"
            >
              <RefreshCcw size={16} /> Ersetzen
            </button>
            <button
              type="button"
              onClick={() =>
                void removeUpload(
                  upload.storagePath,
                  upload.temporaryUploadId,
                )
              }
              className="wizard-secondary-button min-h-11 justify-center px-3 text-red-200"
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
            message.includes("sicher hochgeladen")
              ? "text-sm text-green-300"
              : "text-sm text-amber-200"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
});

export default VideoEvidenceUploader;
