"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import DriverAvatar from "./DriverAvatar";
import { dispatchAppDataChanged } from "@/lib/live/data-events";
import { DRIVER_IMAGE_MAX_BYTES } from "@/lib/storage/driver-image";

type UploadState = { tone: "idle" | "success" | "error"; message: string };

export default function DriverImageUploader({ driverId, driverName, initialImageUrl }: { driverId: number; driverName: string; initialImageUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<UploadState>({ tone: "idle", message: "" });

  function choose(next: File | null) {
    setState({ tone: "idle", message: "" });
    setProgress(0);
    if (!next) return setFile(null);
    if (next.size > DRIVER_IMAGE_MAX_BYTES) {
      setFile(null);
      return setState({ tone: "error", message: "Die Datei ist zu groß. Maximal 3 MB." });
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
    const body = new FormData();
    body.set("image", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/drivers/${driverId}/image`);
    xhr.responseType = "json";
    xhr.upload.addEventListener("progress", (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100)));
    xhr.addEventListener("loadend", () => {
      setBusy(false);
      const payload = xhr.response as { message?: string; imageUrl?: string | null } | null;
      if (xhr.status >= 200 && xhr.status < 300 && payload?.imageUrl) {
        setImageUrl(payload.imageUrl);
        setFile(null);
        setProgress(100);
        if (input.current) input.current.value = "";
        setState({ tone: "success", message: payload.message ?? "Fahrerbild gespeichert." });
        dispatchAppDataChanged(["drivers", "results", "championship", "teams", "users"]);
      } else setState({ tone: "error", message: payload?.message ?? "Das Fahrerbild konnte nicht gespeichert werden." });
    });
    xhr.addEventListener("error", () => { setBusy(false); setState({ tone: "error", message: "Das Fahrerbild konnte nicht gespeichert werden." }); });
    xhr.send(body);
  }

  async function remove() {
    if (!imageUrl || busy || !window.confirm("Fahrerbild wirklich entfernen?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/drivers/${driverId}/image`, { method: "DELETE" });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Das Fahrerbild konnte nicht entfernt werden.");
      setImageUrl(null);
      setState({ tone: "success", message: payload.message ?? "Fahrerbild entfernt." });
      dispatchAppDataChanged(["drivers", "results", "championship", "teams", "users"]);
    } catch (error: unknown) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Das Fahrerbild konnte nicht entfernt werden." });
    } finally { setBusy(false); }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 sm:p-5" aria-labelledby={`driver-image-${driverId}`}>
      <div className="flex min-w-0 items-center gap-4">
        <DriverAvatar imageUrl={imageUrl} name={driverName} size="lg" priority />
        <div className="min-w-0"><h3 id={`driver-image-${driverId}`} className="font-black text-white">Fahrerbild</h3><p className="mt-1 text-xs leading-5 text-slate-400">Optional · PNG, WebP oder JPEG · maximal 3 MB · Metadaten werden entfernt</p></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="master-label">Bild auswählen<input ref={input} type="file" accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg" onChange={(event) => choose(event.target.files?.item(0) ?? null)} disabled={busy} className="form-control mt-2 min-h-12 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500/15 file:px-3 file:py-2 file:text-blue-100" /></label>
        <button type="button" onClick={upload} disabled={!file || busy} className="wizard-primary-button min-h-12 w-full justify-center sm:w-auto"><UploadCloud size={17} />{imageUrl ? "Bild ersetzen" : "Bild hochladen"}</button>
      </div>
      {file ? <p className="mt-2 break-all text-xs text-slate-400"><ImagePlus size={14} className="mr-1 inline" />{file.name}</p> : null}
      {busy || progress > 0 ? <div className="mt-3" aria-label={`Uploadfortschritt ${progress} Prozent`}><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-400 transition-[width]" style={{ width: `${progress}%` }} /></div></div> : null}
      {imageUrl ? <button type="button" onClick={remove} disabled={busy} className="wizard-secondary-button mt-3 min-h-11 w-full justify-center border-red-500/30 text-red-200 sm:w-auto"><Trash2 size={17} />Bild entfernen</button> : null}
      <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${state.tone === "error" ? "text-red-300" : state.tone === "success" ? "text-emerald-300" : "text-slate-400"}`}>{state.message}</p>
    </section>
  );
}
