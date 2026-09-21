"use client";

import Image from "next/image";
import { ImagePlus, Replace, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type HeroValues = {
  desktopHeroAsset?: string | null;
  mobileHeroAsset?: string | null;
  heroAltText?: string | null;
};

export default function RaceHeroFields({
  values,
  mode,
}: {
  values?: HeroValues | null;
  mode: "track" | "race";
}) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-violet-400/20 bg-[linear-gradient(145deg,rgba(124,58,237,.10),rgba(14,20,28,.88)_45%,rgba(14,165,233,.07))] p-4 sm:p-5">
      <div className="max-w-3xl">
        <p className="eyebrow text-violet-300">Race-Weekend-Bilder</p>
        <h3 className="mt-2 text-lg font-black text-white">
          {mode === "track" ? "Responsive Standardbilder" : "Event-spezifische Bilder"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {mode === "track"
            ? "Diese Motive werden automatisch für alle Rennen auf dieser Strecke verwendet, solange das Rennen kein eigenes Bild überschreibt."
            : "Optional: Leere Felder übernehmen automatisch die Bilder der zentral zugeordneten Strecke."}
        </p>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <HeroAssetField
          name="desktopHeroAsset"
          variant="desktop"
          label="Desktop / PC Hero"
          hint="Breites Querformat · empfohlen 1920 × 1080 (16:9) · mindestens 1280 × 640"
          defaultValue={values?.desktopHeroAsset}
        />
        <HeroAssetField
          name="mobileHeroAsset"
          variant="mobile"
          label="Mobile / Handy Hero"
          hint="Hochformat · empfohlen 1080 × 1350 (4:5) · mindestens 720 × 900"
          defaultValue={values?.mobileHeroAsset}
        />
      </div>

      <label className="master-label mt-5">
        Bildbeschreibung (optional)
        <input
          name="heroAltText"
          defaultValue={values?.heroAltText ?? ""}
          maxLength={300}
          placeholder="Zum Beispiel: Start-Ziel-Gerade in Monza bei Sonnenuntergang"
          className="form-control mt-2"
        />
        <span className="mt-2 block text-xs font-normal text-slate-500">
          Für Screenreader; ohne Eingabe wird automatisch Rennen und Strecke beschrieben.
        </span>
      </label>
    </section>
  );
}

function HeroAssetField({
  name,
  variant,
  label,
  hint,
  defaultValue,
}: {
  name: "desktopHeroAsset" | "mobileHeroAsset";
  variant: "desktop" | "mobile";
  label: string;
  hint: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [localPreview, setLocalPreview] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  async function upload(file: File | undefined) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setUploading(true);
    setStatus("Bild wird geprüft und optimiert …");
    const body = new FormData();
    body.set("asset", file);
    body.set("kind", variant);
    try {
      const response = await fetch("/api/admin/tracks/assets", { method: "POST", body });
      const result = (await response.json()) as { url?: string; width?: number; height?: number; message?: string };
      if (!response.ok || !result.url) {
        setLocalPreview("");
        setStatus(result.message ?? "Upload fehlgeschlagen.");
        return;
      }
      setValue(result.url);
      setStatus(`Optimiert gespeichert · ${result.width} × ${result.height} WebP`);
    } catch {
      setLocalPreview("");
      setStatus("Upload fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setValue("");
    setLocalPreview("");
    setStatus("Bild entfernt. Änderung noch speichern.");
  }

  const preview = localPreview || value;
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
      <input type="hidden" name={name} value={value} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-300">
          {variant === "desktop" ? "16:9" : "4:5"}
        </span>
      </div>
      <div className={`relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/70 ${variant === "desktop" ? "aspect-video" : "mx-auto aspect-[4/5] w-full max-w-64"}`}>
        {preview ? (
          <Image src={preview} alt={`${label} Vorschau`} fill sizes={variant === "desktop" ? "(max-width: 1024px) 90vw, 520px" : "256px"} className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-slate-500">
            <ImagePlus className="size-10" strokeWidth={1.4} />
            <p className="mt-2 text-xs font-semibold">Noch kein eigenes Bild</p>
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="wizard-secondary-button min-h-11 cursor-pointer justify-center">
          <Replace size={16} />
          {uploading ? "Optimiert …" : preview ? "Ersetzen" : "Bild wählen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
        <button type="button" onClick={remove} disabled={!preview} className="danger-button min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-40">
          <Trash2 size={16} /> Entfernen
        </button>
      </div>
      {status ? <p role="status" className={`mt-3 text-xs ${status.includes("gespeichert") ? "text-emerald-300" : "text-slate-400"}`}>{status}</p> : null}
    </div>
  );
}
