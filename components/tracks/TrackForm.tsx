"use client";

import { useActionState, useState } from "react";
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
        <Field label="Ländercode" name="countryCode" defaultValue={track?.countryCode ?? "DE"} required maxLength={2} />
        <label className="master-label">Status<select name="active" defaultValue={track?.active === false ? "off" : "on"} className="form-control mt-2"><option value="on">Aktiv</option><option value="off">Inaktiv</option></select></label>
        <Field label="Länge (km)" name="lengthKm" type="number" step="0.001" defaultValue={track?.lengthKm ?? undefined} />
        <Field label="Runden" name="lapCount" type="number" defaultValue={track?.lapCount ?? undefined} />
        <Field label="Gesamtdistanz (km)" name="totalDistanceKm" type="number" step="0.001" defaultValue={track?.totalDistanceKm ?? undefined} />
        <Field label="Sektoren" name="sectorCount" type="number" defaultValue={track?.sectorCount ?? 3} required />
        <Field label="DRS-Zonen" name="drsZones" type="number" defaultValue={track?.drsZones ?? undefined} />
        <Field label="Overtake Points" name="overtakePoints" type="number" defaultValue={track?.overtakePoints ?? undefined} />
        <Field label="Längste Gerade (m)" name="longestStraightM" type="number" defaultValue={track?.longestStraightM ?? undefined} />
        <Field label="Pitlane-Verlust (s)" name="pitLaneLossSeconds" type="number" step="0.1" defaultValue={track?.pitLaneLossSeconds ?? undefined} />
        <label className="master-label">Pole-Seite<select name="poleSide" defaultValue={track?.poleSide ?? ""} className="form-control mt-2"><option value="">Nicht hinterlegt</option><option value="LEFT">Links</option><option value="RIGHT">Rechts</option></select></label>
      </div>

      <label className="master-label">Besondere Streckenhinweise<textarea name="notes" defaultValue={track?.notes ?? ""} rows={3} maxLength={4000} className="form-control mt-2" /></label>

      <section className="rounded-2xl border border-[color-mix(in_srgb,var(--page-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--page-accent)_7%,var(--color-card))] p-4">
        <p className="eyebrow">Track Visual</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <AssetField label="Streckenlayout" name="layoutAsset" defaultValue={visual?.layoutAsset} />
          <label className="master-label">Layoutformat<select name="layoutMimeType" defaultValue={visual?.layoutMimeType ?? "image/svg+xml"} className="form-control mt-2"><option value="image/svg+xml">SVG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>
          <AssetField label="Hero-Bild" name="heroAsset" defaultValue={visual?.heroAsset} />
          <AssetField label="Mobiles Hero-Bild" name="mobileHeroAsset" defaultValue={visual?.mobileHeroAsset} />
          <AssetField label="Streckenlogo" name="trackLogoAsset" defaultValue={visual?.trackLogoAsset} />
          <div className="grid grid-cols-2 gap-3"><ColorField label="Primärfarbe" name="primaryColor" value={visual?.primaryColor ?? "#3B82F6"} /><ColorField label="Sekundärfarbe" name="secondaryColor" value={visual?.secondaryColor ?? "#22D3EE"} /></div>
          <Field label="Overlay-Stärke (%)" name="overlayStrength" type="number" defaultValue={visual?.overlayStrength ?? 65} required />
          <div className="grid grid-cols-2 gap-3"><label className="master-label">Bildposition<select name="imagePosition" defaultValue={visual?.imagePosition ?? "center"} className="form-control mt-2"><option value="left">Links</option><option value="center">Mitte</option><option value="right">Rechts</option></select></label><label className="master-label">Bildausschnitt<select name="imageCrop" defaultValue={visual?.imageCrop ?? "cover"} className="form-control mt-2"><option value="cover">Cover</option><option value="contain">Contain</option></select></label></div>
          <ColorField label="Eigene Layoutfarbe" name="layoutColor" value={visual?.layoutColor ?? "#3B82F6"} />
          <Field label="Linienbreite" name="lineWidth" type="number" defaultValue={visual?.lineWidth ?? 3} required />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Check name="lightBannerText" label="Heller Bannertext" checked={visual?.lightBannerText ?? true} />
          <Check name="useThemeLayoutColor" label="Themefarbe fürs Layout" checked={visual?.useThemeLayoutColor ?? true} />
          <Check name="showStartFinish" label="Start/Ziel markieren" checked={visual?.showStartFinish ?? true} />
          <Check name="showSectors" label="Sektoren markieren" checked={visual?.showSectors ?? false} />
          <Check name="showDrsZones" label="DRS-Zonen markieren" checked={visual?.showDrsZones ?? false} />
          <Check name="showOvertakePoints" label="Overtake Points" checked={visual?.showOvertakePoints ?? false} />
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

function AssetField({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setStatus("");
    const body = new FormData();
    body.set("asset", file);
    try {
      const response = await fetch("/api/admin/tracks/assets", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !result.url) {
        setStatus(result.message ?? "Upload fehlgeschlagen.");
        return;
      }
      setValue(result.url);
      setStatus("Upload abgeschlossen.");
    } catch {
      setStatus("Upload fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="master-label">
      <label htmlFor={`${name}-value`}>{label}</label>
      <input id={`${name}-value`} name={name} value={value} onChange={(event) => setValue(event.target.value)} placeholder="/assets/tracks/... oder https://..." className="form-control mt-2" />
      <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text-muted)] transition hover:border-[var(--page-accent)] hover:text-[var(--page-accent)]">
        {uploading ? "Wird hochgeladen…" : "SVG, PNG oder WebP hochladen"}
        <input type="file" accept="image/svg+xml,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />
      </label>
      <span className={`mt-1 block text-xs font-normal ${status.includes("abgeschlossen") ? "text-emerald-300" : "text-[var(--color-text-muted)]"}`}>{status || "Maximal 4 MB. SVG wird vor dem Speichern sicherheitsgeprüft."}</span>
    </div>
  );
}

function ColorField({ label, name, value }: { label: string; name: string; value: string }) {
  return <label className="master-label">{label}<input type="color" name={name} defaultValue={value} className="form-control mt-2 h-12 p-1" /></label>;
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-3 text-sm"><input type="checkbox" name={name} defaultChecked={checked} className="size-4" />{label}</label>;
}
