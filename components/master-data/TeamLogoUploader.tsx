"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import TeamLogo from "@/components/teams/TeamLogo";
import { dispatchAppDataChanged } from "@/lib/live/data-events";
import { TEAM_LOGO_MAX_BYTES } from "@/lib/storage/team-logo-image";

type UploadState = { tone: "idle" | "success" | "error"; message: string };

export default function TeamLogoUploader({
  organizationId,
  teamName,
  shortName,
  primaryColor,
  initialLogoUrl,
}: {
  organizationId: number;
  teamName: string;
  shortName: string;
  primaryColor: string;
  initialLogoUrl: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>({ tone: "idle", message: "" });

  function choose(next: File | null) {
    setState({ tone: "idle", message: "" });
    setProgress(0);
    if (!next) return setFile(null);
    if (next.size > TEAM_LOGO_MAX_BYTES) {
      setFile(null);
      return setState({ tone: "error", message: "Diese Datei ist zu groß. Maximal 2 MB." });
    }
    if (!new Set(["image/png", "image/webp", "image/jpeg"]).has(next.type.toLowerCase())) {
      setFile(null);
      return setState({ tone: "error", message: "Nur PNG, WebP und JPEG sind erlaubt." });
    }
    setFile(next);
  }

  function upload() {
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setState({ tone: "idle", message: "Logo wird verarbeitet und hochgeladen …" });
    const body = new FormData();
    body.set("logo", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/teams/${organizationId}/logo`);
    xhr.responseType = "json";
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("loadend", () => {
      setBusy(false);
      const response = xhr.response as { message?: string; logoUrl?: string | null } | null;
      if (xhr.status >= 200 && xhr.status < 300 && response?.logoUrl) {
        setLogoUrl(response.logoUrl);
        setFile(null);
        setProgress(100);
        if (input.current) input.current.value = "";
        setState({ tone: "success", message: response.message ?? "Logo wurde erfolgreich hochgeladen." });
        dispatchAppDataChanged(["teams", "drivers", "championship", "results", "attendance", "users"]);
      } else {
        setState({ tone: "error", message: response?.message ?? "Das Logo konnte nicht gespeichert werden." });
      }
    });
    xhr.addEventListener("error", () => {
      setBusy(false);
      setState({ tone: "error", message: "Das Logo konnte nicht gespeichert werden." });
    });
    xhr.send(body);
  }

  async function remove() {
    if (!logoUrl || busy || !window.confirm("Teamlogo wirklich entfernen?")) return;
    setBusy(true);
    setState({ tone: "idle", message: "Logo wird entfernt …" });
    try {
      const response = await fetch(`/api/admin/teams/${organizationId}/logo`, { method: "DELETE" });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Das Logo konnte nicht entfernt werden.");
      setLogoUrl(null);
      setState({ tone: "success", message: payload.message ?? "Logo wurde entfernt." });
      dispatchAppDataChanged(["teams", "drivers", "championship", "results", "attendance", "users"]);
    } catch (error: unknown) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Das Logo konnte nicht entfernt werden." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 sm:p-5" aria-labelledby={`team-logo-${organizationId}`}>
      <div className="flex min-w-0 items-center gap-4">
        <TeamLogo logoUrl={logoUrl} teamName={teamName} shortName={shortName} primaryColor={primaryColor} size="lg" priority />
        <div className="min-w-0">
          <h3 id={`team-logo-${organizationId}`} className="font-black text-white">Teamlogo</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">PNG, WebP oder JPEG · maximal 2 MB · Ausgabe als WebP</p>
        </div>
      </div>

      <div
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files.item(0)); }}
        className={`mt-4 flex min-h-28 min-w-0 flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition ${dragging ? "border-cyan-400 bg-cyan-400/10" : "border-slate-700 bg-slate-950/45"}`}
      >
        <UploadCloud size={24} className="text-cyan-300" />
        <p className="mt-2 break-all text-sm font-semibold text-slate-200">{file?.name ?? "Datei hierher ziehen"}</p>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="wizard-secondary-button mt-3 min-h-11 w-full sm:w-auto">
          <ImagePlus size={17} /> Datei auswählen
        </button>
        <input ref={input} type="file" accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg" onChange={(event) => choose(event.target.files?.item(0) ?? null)} className="sr-only" />
      </div>

      {busy || progress > 0 ? (
        <div className="mt-4" aria-label={`Uploadfortschritt ${progress} Prozent`}>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-400 transition-[width]" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1 text-right text-xs text-slate-400">{progress}%</p>
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={upload} disabled={!file || busy} className="wizard-primary-button min-h-11 w-full sm:w-auto">
          <UploadCloud size={17} /> {logoUrl ? "Logo ersetzen" : "Logo hochladen"}
        </button>
        {logoUrl ? <button type="button" onClick={remove} disabled={busy} className="wizard-secondary-button min-h-11 w-full border-red-500/30 text-red-200 sm:w-auto"><Trash2 size={17} /> Logo entfernen</button> : null}
      </div>
      <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${state.tone === "error" ? "text-red-300" : state.tone === "success" ? "text-emerald-300" : "text-slate-400"}`}>{state.message}</p>
    </section>
  );
}
