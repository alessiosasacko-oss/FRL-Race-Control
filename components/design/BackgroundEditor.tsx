"use client";

import { ImageIcon, Layers3, Palette, Replace, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import AppBackground from "@/components/design/AppBackground";
import {
  backgroundPatterns,
  defaultBackgroundSettings,
  type BackgroundSettings,
  type DesignThemeConfig,
} from "@/lib/design/theme";

const typeOptions = [
  ["COLOR", "Farbe", Palette],
  ["GRADIENT", "Verlauf", Sparkles],
  ["PATTERN", "Muster", Layers3],
  ["IMAGE", "Bild", ImageIcon],
] as const;

const patternLabels: Record<(typeof backgroundPatterns)[number], string> = {
  NONE: "Kein Muster",
  FINE_GRID: "Feines Raster",
  DOTS: "Punkte",
  DIAGONAL_LINES: "Diagonale Linien",
  CARBON: "Carbon-Struktur",
  TRACK_LINES: "Rennstreckenlinien",
  BLUEPRINT_GRID: "Blueprint-Raster",
  CHECKERED: "Zielflaggen-Muster",
  NOISE: "Dezentes Rauschen",
  SPEED_LINES: "Geschwindigkeitsspuren",
};

type Props = {
  config: DesignThemeConfig;
  setConfig: React.Dispatch<React.SetStateAction<DesignThemeConfig>>;
  themeId: number | null;
  mode: "DARK" | "LIGHT";
};

export default function BackgroundEditor({ config, setConfig, themeId, mode }: Props) {
  const settings = config.backgroundSettings;
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; dimensions?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof BackgroundSettings>(key: K, value: BackgroundSettings[K]) {
    setConfig((current) => ({
      ...current,
      preset: "CUSTOM",
      backgroundSettings: { ...current.backgroundSettings, [key]: value },
    }));
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadMessage("");
    setFileInfo({ name: file.name, size: file.size });
    const body = new FormData();
    body.set("image", file);
    if (themeId) body.set("themeId", String(themeId));
    try {
      const response = await fetch("/api/admin/design/backgrounds", { method: "POST", body });
      const result = (await response.json()) as { url?: string; width?: number; height?: number; message?: string };
      if (!response.ok || !result.url) {
        setUploadMessage(result.message ?? "Upload fehlgeschlagen.");
        return;
      }
      update("assetPath", result.url);
      update("type", "IMAGE");
      setFileInfo({ name: file.name, size: file.size, dimensions: result.width && result.height ? `${result.width} × ${result.height} px` : undefined });
      setUploadMessage("Hintergrundbild hochgeladen. Speichere den Entwurf, um die Referenz zu übernehmen.");
    } catch {
      setUploadMessage("Upload fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="surface-panel min-w-0 p-5 sm:p-6">
      <h2 className="text-xl font-black">Globaler App-Hintergrund</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Zentraler Hintergrund für App, Login, Dashboard und öffentliche Seiten.</p>

      <div className="mt-5">
        <p className="eyebrow">Hintergrundart</p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {typeOptions.map(([value, label, Icon]) => (
            <button key={value} type="button" onClick={() => update("type", value)} className={`min-h-20 rounded-2xl border p-3 text-left transition ${settings.type === value ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)]" : "border-[var(--color-border)] bg-[var(--color-background-elevated)]"}`}>
              <Icon size={20} className="text-[var(--color-primary)]" /><span className="mt-2 block text-sm font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {settings.type === "COLOR" ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ColorControl label="Allgemeine Fallback-Farbe" value={settings.color} fallback={defaultBackgroundSettings.color} onChange={(value) => update("color", value)} />
          <ColorControl label="Dark Mode" value={settings.colorDark} fallback={defaultBackgroundSettings.colorDark} onChange={(value) => update("colorDark", value)} />
          <ColorControl label="Light Mode" value={settings.colorLight} fallback={defaultBackgroundSettings.colorLight} onChange={(value) => update("colorLight", value)} />
        </div>
      ) : null}

      {settings.type === "GRADIENT" ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {settings.gradientColors.map((color, index) => <ColorControl key={index} label={`Verlaufsfarbe ${index + 1}`} value={color} fallback={defaultBackgroundSettings.gradientColors[index] ?? defaultBackgroundSettings.gradientColors[1]} onChange={(value) => update("gradientColors", settings.gradientColors.map((current, colorIndex) => colorIndex === index ? value : current))} />)}
          </div>
          <button type="button" onClick={() => update("gradientColors", settings.gradientColors.length === 3 ? settings.gradientColors.slice(0, 2) : [...settings.gradientColors, "#1F6BFF"])} className="wizard-secondary-button min-h-11">{settings.gradientColors.length === 3 ? "Dritte Farbe entfernen" : "Dritte Farbe hinzufügen"}</button>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SelectControl label="Verlaufsart" value={settings.gradientType} options={["LINEAR", "RADIAL"]} onChange={(value) => update("gradientType", value as BackgroundSettings["gradientType"])} />
            <SelectControl label="Radiale Position" value={settings.gradientPosition} options={["CENTER", "TOP", "BOTTOM", "LEFT", "RIGHT"]} disabled={settings.gradientType !== "RADIAL"} onChange={(value) => update("gradientPosition", value as BackgroundSettings["gradientPosition"])} />
            <RangeControl label="Drehwinkel" value={settings.gradientAngle} min={0} max={360} suffix="°" disabled={settings.gradientType !== "LINEAR"} onChange={(value) => update("gradientAngle", value)} />
            <RangeControl label="Intensität" value={settings.gradientIntensity} min={10} max={100} suffix="%" onChange={(value) => update("gradientIntensity", value)} />
          </div>
        </div>
      ) : null}

      {settings.type === "PATTERN" ? (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {backgroundPatterns.map((pattern) => {
              const previewSettings = { ...settings, type: "PATTERN" as const, pattern, overlayOpacity: 0, contentDim: 0 };
              return <button key={pattern} type="button" onClick={() => update("pattern", pattern)} className={`min-w-0 overflow-hidden rounded-xl border text-left ${settings.pattern === pattern ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}><span className="relative block h-16 overflow-hidden"><AppBackground settings={previewSettings} mode={mode} preview /></span><span className="block truncate px-2 py-2 text-xs font-bold">{patternLabels[pattern]}</span></button>;
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ColorControl label="Musterfarbe" value={settings.patternColor} fallback={defaultBackgroundSettings.patternColor} onChange={(value) => update("patternColor", value)} />
            <ColorControl label="Hintergrundfarbe" value={settings.patternBackgroundColor} fallback={defaultBackgroundSettings.patternBackgroundColor} onChange={(value) => update("patternBackgroundColor", value)} />
            <SelectControl label="Mischmodus" value={settings.patternBlendMode} options={["NORMAL", "SCREEN", "OVERLAY", "SOFT_LIGHT"]} onChange={(value) => update("patternBlendMode", value as BackgroundSettings["patternBlendMode"])} />
            <RangeControl label="Deckkraft" value={settings.patternOpacity} min={0} max={40} suffix="%" onChange={(value) => update("patternOpacity", value)} />
            <RangeControl label="Skalierung" value={settings.patternScale} min={20} max={200} suffix="%" onChange={(value) => update("patternScale", value)} />
            <RangeControl label="Abstand" value={settings.patternSpacing} min={4} max={100} suffix=" px" onChange={(value) => update("patternSpacing", value)} />
            <RangeControl label="Drehung" value={settings.patternRotation} min={-180} max={180} suffix="°" onChange={(value) => update("patternRotation", value)} />
            <RangeControl label="Kontrast" value={settings.patternContrast} min={50} max={200} suffix="%" onChange={(value) => update("patternContrast", value)} />
          </div>
        </div>
      ) : null}

      {settings.type === "IMAGE" ? (
        <div className="mt-5 space-y-5">
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadImage(event.dataTransfer.files[0]); }} className="min-w-0 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4">
            <div className="relative min-h-48 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
              {settings.assetPath ? <AppBackground settings={{ ...settings, overlayOpacity: 0, contentDim: 0 }} mode={mode} preview /> : <div className="absolute inset-0 flex items-center justify-center text-center text-[var(--color-text-muted)]"><div><ImageIcon className="mx-auto size-12" strokeWidth={1.4} /><p className="mt-3 text-sm font-bold">Hintergrundbild auswählen</p><p className="mt-1 text-xs">JPG, PNG oder WebP · maximal 10 MB</p></div></div>}
            </div>
            <p className="mt-3 truncate text-sm font-bold">{fileInfo?.name ?? (settings.assetPath ? assetName(settings.assetPath) : "Keine Datei ausgewählt")}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{fileInfo ? `${formatBytes(fileInfo.size)}${fileInfo.dimensions ? ` · ${fileInfo.dimensions}` : ""}` : "Empfohlen: 1920 × 1080 px oder größer; mobil 1080 × 1920 px."}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="wizard-secondary-button min-h-11 justify-center"><Upload size={17} />{uploading ? "Wird hochgeladen…" : settings.assetPath ? "Bild ersetzen" : "Bild auswählen"}</button>
              <button type="button" disabled={!settings.assetPath} onClick={() => { update("assetPath", ""); setFileInfo(null); setUploadMessage("Bildreferenz entfernt. Die versionierte Storage-Datei bleibt erhalten."); }} className="danger-button min-h-11 justify-center disabled:opacity-40"><Trash2 size={17} />Bild entfernen</button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadImage(event.target.files?.[0])} />
            </div>
            {uploadMessage ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{uploadMessage}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ColorControl label="Fallback-Farbe" value={settings.color} fallback={defaultBackgroundSettings.color} onChange={(value) => update("color", value)} />
            <SelectControl label="Bildanpassung" value={settings.imageFit} options={["COVER", "CONTAIN", "AUTO"]} onChange={(value) => update("imageFit", value as BackgroundSettings["imageFit"])} />
            <SelectControl label="Scrollverhalten" value={settings.imageAttachment} options={["FIXED", "SCROLL"]} onChange={(value) => update("imageAttachment", value as BackgroundSettings["imageAttachment"])} />
            <RangeControl label="Position X" value={settings.imagePositionX} min={0} max={100} suffix="%" onChange={(value) => update("imagePositionX", value)} />
            <RangeControl label="Position Y" value={settings.imagePositionY} min={0} max={100} suffix="%" onChange={(value) => update("imagePositionY", value)} />
            <RangeControl label="Deckkraft" value={settings.imageOpacity} min={0} max={100} suffix="%" onChange={(value) => update("imageOpacity", value)} />
            <RangeControl label="Helligkeit" value={settings.imageBrightness} min={25} max={175} suffix="%" onChange={(value) => update("imageBrightness", value)} />
            <RangeControl label="Kontrast" value={settings.imageContrast} min={25} max={175} suffix="%" onChange={(value) => update("imageContrast", value)} />
            <RangeControl label="Sättigung" value={settings.imageSaturation} min={0} max={200} suffix="%" onChange={(value) => update("imageSaturation", value)} />
            <RangeControl label="Weichzeichnen" value={settings.imageBlur} min={0} max={24} suffix=" px" onChange={(value) => update("imageBlur", value)} />
          </div>
        </div>
      ) : null}

      <div className="mt-6 border-t border-[var(--color-border)] pt-5">
        <h3 className="font-black">Lesbarkeit & Geltungsbereich</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ColorControl label="Overlay-Farbe" value={settings.overlayColor} fallback={defaultBackgroundSettings.overlayColor} onChange={(value) => update("overlayColor", value)} />
          <RangeControl label="Overlay-Deckkraft" value={settings.overlayOpacity} min={0} max={90} suffix="%" onChange={(value) => update("overlayOpacity", value)} />
          <RangeControl label="Inhaltsbereich abdunkeln" value={settings.contentDim} min={0} max={50} suffix="%" onChange={(value) => update("contentDim", value)} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CheckControl label="Navigation stärker abheben" checked={settings.navigationEmphasis} onChange={(value) => update("navigationEmphasis", value)} />
          <CheckControl label="Glas-Effekt für Oberflächen" checked={settings.glassSurfaces} onChange={(value) => update("glassSurfaces", value)} />
        </div>
        <p className="eyebrow mt-5">Verwenden auf</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([['PROTECTED_APP', 'Geschützte App'], ['LOGIN', 'Login-Seite'], ['DASHBOARD', 'Dashboard'], ['PUBLIC', 'Öffentliche Seiten']] as const).map(([scope, label]) => <CheckControl key={scope} label={label} checked={settings.scopes.includes(scope)} onChange={(checked) => { const next = checked ? [...settings.scopes, scope] : settings.scopes.filter((value) => value !== scope); if (next.length) update("scopes", next); }} />)}
        </div>
      </div>
    </section>
  );
}

function ColorControl({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (value: string) => void }) {
  const safePickerValue = /^#[0-9A-F]{6}$/i.test(value) ? value : "#000000";
  return <label className="master-label min-w-0">{label}<span className="mt-2 grid grid-cols-[3rem_minmax(0,1fr)_2.75rem] gap-2"><input type="color" value={safePickerValue} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-11 w-12 cursor-pointer rounded-lg border-0 bg-transparent" /><input value={value} maxLength={7} onChange={(event) => onChange(event.target.value.toUpperCase())} className="form-control min-w-0 font-mono" /><button type="button" onClick={() => onChange(fallback)} aria-label={`${label} zurücksetzen`} className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)]"><Replace size={15} /></button></span></label>;
}

function SelectControl({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="master-label">{label}<select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="form-control mt-2 disabled:opacity-45">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function RangeControl({ label, value, min, max, suffix, onChange, disabled = false }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void; disabled?: boolean }) {
  return <label className="master-label">{label} <span className="text-[var(--color-text-muted)]">{value}{suffix}</span><input type="range" min={min} max={max} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 min-h-11 w-full accent-[var(--color-primary)] disabled:opacity-45" /></label>;
}

function CheckControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4" />{label}</label>;
}

function assetName(value: string) {
  try { return decodeURIComponent(new URL(value).pathname.split("/").pop() || "Gespeichertes Hintergrundbild"); } catch { return "Gespeichertes Hintergrundbild"; }
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 2 })} MB`;
}
