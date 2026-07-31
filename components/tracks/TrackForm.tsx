"use client";

import Image from "next/image";
import { ImagePlus, Replace, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import CountrySelect from "@/components/ui/CountrySelect";
import { createTrackAction, deleteTrackAction, updateTrackAction } from "@/lib/tracks/actions";
import { initialTrackActionState } from "@/lib/tracks/types";

type TrackItem = Awaited<ReturnType<typeof import("@/lib/tracks/queries").getTrackAdminData>>[number];

export default function TrackForm({ track }: { track?: TrackItem }) {
  const action = track ? updateTrackAction.bind(null, track.id) : createTrackAction;
  const [state, formAction, pending] = useActionState(action, initialTrackActionState);
  const visual = track?.visual;

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Streckenname" name="name" defaultValue={track?.name} required className="xl:col-span-2" />
        <label className="master-label">Land<CountrySelect defaultValue={track?.countryCode ?? "DE"} /></label>
        <label className="master-label">Status<select name="active" defaultValue={track?.active === false ? "off" : "on"} className="form-control mt-2"><option value="on">Aktiv</option><option value="off">Inaktiv</option></select></label>
        <Field label="Streckenlänge (km)" name="lengthKm" type="number" step="0.001" defaultValue={track?.lengthKm ?? undefined} />
        <Field label="Runden" name="lapCount" type="number" defaultValue={track?.lapCount ?? undefined} />
        <Field label="Sektoren" name="sectorCount" type="number" defaultValue={track?.sectorCount ?? 3} required />
        <Field label="SM Straight Mode (Zonen)" name="smStraightModeZones" type="number" min="0" max="20" defaultValue={track?.smStraightModeZones ?? undefined} />
        <Field label="Längste Gerade (m)" name="longestStraightM" type="number" defaultValue={track?.longestStraightM ?? undefined} />
        <Field label="Pitlane-Verlust (s)" name="pitLaneLossSeconds" type="number" step="0.1" defaultValue={track?.pitLaneLossSeconds ?? undefined} />
        <label className="master-label">Pole-Seite<select name="poleSide" defaultValue={track?.poleSide ?? ""} className="form-control mt-2"><option value="">Nicht hinterlegt</option><option value="LEFT">Links</option><option value="RIGHT">Rechts</option></select></label>
      </div>

      <label className="master-label">Besondere Streckenhinweise<textarea name="notes" defaultValue={track?.notes ?? ""} rows={3} maxLength={4000} className="form-control mt-2" /></label>

      <section className="rounded-2xl border border-[color-mix(in_srgb,var(--page-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--page-accent)_7%,var(--color-card))] p-4">
        <p className="eyebrow">Streckenlayout</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
          <LayoutAssetField defaultValue={visual?.layoutAsset} defaultMimeType={visual?.layoutMimeType} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="grid grid-cols-2 gap-3"><ColorField label="Primärfarbe" name="primaryColor" value={visual?.primaryColor ?? "#3B82F6"} /><ColorField label="Sekundärfarbe" name="secondaryColor" value={visual?.secondaryColor ?? "#22D3EE"} /></div>
            <Field label="Hintergrundintensität (%)" name="overlayStrength" type="number" defaultValue={visual?.overlayStrength ?? 65} required />
            <ColorField label="Eigene Layoutfarbe" name="layoutColor" value={visual?.layoutColor ?? "#3B82F6"} />
            <Field label="Layout-Linienstärke" name="lineWidth" type="number" defaultValue={visual?.lineWidth ?? 3} required />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Check name="lightBannerText" label="Heller Bannertext" checked={visual?.lightBannerText ?? true} />
          <Check name="useThemeLayoutColor" label="Themefarbe fürs Layout" checked={visual?.useThemeLayoutColor ?? true} />
          <Check name="showStartFinish" label="Start/Ziel markieren" checked={visual?.showStartFinish ?? true} />
          <Check name="showSectors" label="Sektoren markieren" checked={visual?.showSectors ?? false} />
          <Check name="showCornerNumbers" label="Kurvennummern" checked={visual?.showCornerNumbers ?? false} />
        </div>
      </section>

      {state.message ? <p className={`text-sm ${state.status === "success" ? "text-emerald-300" : "text-red-300"}`}>{state.message}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {track && track._count.races === 0 ? <button type="submit" formAction={deleteTrackAction.bind(null, track.id)} className="danger-button">Strecke löschen</button> : null}
        <button disabled={pending} className="wizard-primary-button">{pending ? "Speichert…" : track ? "Strecke aktualisieren" : "Strecke erstellen"}</button>
      </div>
    </form>
  );
}

function Field({ label, name, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; className?: string }) {
  return <label className={`master-label ${className}`}>{label}<input name={name} className="form-control mt-2" {...props} /></label>;
}

function LayoutAssetField({ defaultValue, defaultMimeType }: { defaultValue?: string | null; defaultMimeType?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [mimeType, setMimeType] = useState(defaultMimeType ?? "");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [localPreview, setLocalPreview] = useState("");

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setLocalPreview(URL.createObjectURL(file));
    setFileInfo({ name: file.name, size: file.size });
    setUploading(true);
    setStatus("");
    const body = new FormData();
    body.set("asset", file);
    try {
      const response = await fetch("/api/admin/tracks/assets", { method: "POST", body });
      const result = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !result.url) {
        setStatus(result.message ?? "Upload fehlgeschlagen.");
        return;
      }
      setValue(result.url);
      setMimeType(file.type);
      setStatus("Upload abgeschlossen.");
    } catch {
      setStatus("Upload fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setValue("");
    setMimeType("");
    setFileInfo(null);
    setLocalPreview("");
    setStatus("Layout entfernt. Änderung noch speichern.");
  }

  return (
    <div className="min-w-0 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4">
      <input type="hidden" name="layoutAsset" value={value} />
      <input type="hidden" name="layoutMimeType" value={mimeType} />
      <div className="relative flex min-h-52 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--page-accent)_14%,transparent),transparent_70%)] p-4">
        {localPreview || value ? (
          <Image src={localPreview || value} alt="Vorschau des Streckenlayouts" fill sizes="(max-width: 1024px) 90vw, 520px" className="object-contain p-4" unoptimized />
        ) : (
          <div className="text-center text-[var(--color-text-muted)]"><ImagePlus className="mx-auto size-12" strokeWidth={1.4} /><p className="mt-3 text-sm font-bold">Noch kein Streckenlayout</p><p className="mt-1 text-xs">SVG, PNG oder WebP · maximal 4 MB</p></div>
        )}
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-sm font-bold text-white">{fileInfo?.name ?? (value ? assetName(value) : "Keine Datei ausgewählt")}</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{fileInfo ? formatBytes(fileInfo.size) : value ? "Bereits gespeichertes Layout" : "SVG wird serverseitig sicherheitsgeprüft."}</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="wizard-secondary-button min-h-11 cursor-pointer justify-center"><Replace size={17} />{uploading ? "Wird hochgeladen…" : value ? "Ersetzen" : "Streckenlayout hochladen"}<input type="file" accept="image/svg+xml,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} /></label>
        <button type="button" disabled={!value && !localPreview} onClick={remove} className="danger-button min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={17} />Entfernen</button>
      </div>
      {status ? <span className={`mt-2 block text-xs font-normal ${status.includes("abgeschlossen") ? "text-emerald-300" : "text-[var(--color-text-muted)]"}`}>{status}</span> : null}
    </div>
  );
}

function assetName(value: string) {
  try {
    return decodeURIComponent(new URL(value, "http://local").pathname.split("/").pop() || "Gespeichertes Layout");
  } catch {
    return "Gespeichertes Layout";
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 2 })} MB`;
}

function ColorField({ label, name, value }: { label: string; name: string; value: string }) {
  return <label className="master-label">{label}<input type="color" name={name} defaultValue={value} className="form-control mt-2 h-12 p-1" /></label>;
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-3 text-sm"><input type="checkbox" name={name} defaultChecked={checked} className="size-4" />{label}</label>;
}
