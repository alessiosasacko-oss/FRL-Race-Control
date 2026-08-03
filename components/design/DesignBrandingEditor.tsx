"use client";

import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  Flag,
  Gauge,
  Palette,
  RotateCcw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import AppBackground from "@/components/design/AppBackground";
import BackgroundEditor from "@/components/design/BackgroundEditor";
import CountryFlag from "@/components/ui/CountryFlag";
import {
  publishDesignAction,
  restoreDefaultDesignAction,
  restoreDesignVersionAction,
  saveDesignDraftAction,
  updateLeagueBrandingAction,
  updateTeamBrandingAction,
} from "@/lib/design/actions";
import {
  designPresetLabels,
  designThemeConfigSchema,
  themeContrastWarnings,
  themeCssVariables,
  themePresets,
  type DesignPreset,
  type DesignThemeConfig,
  type PageAccents,
  type ThemeTokens,
} from "@/lib/design/theme";
import {
  initialDesignActionState,
  type DesignActionState,
} from "@/lib/design/types";

type AdminData = {
  themeId: number | null;
  config: DesignThemeConfig;
  activeThemeName: string;
  isDraft: boolean;
  versions: Array<{
    id: number;
    version: number;
    themeName: string;
    createdBy: string;
    createdAt: string;
  }>;
  leagues: Array<{ id: number; code: string; name: string; color: string | null }>;
  teams: Array<{
    id: number;
    name: string;
    shortName: string;
    color: string;
    secondaryColor: string | null;
    contrastColor: string | null;
    logoUrl: string | null;
  }>;
};

const tokenFields: Array<[keyof ThemeTokens, string, string]> = [
  ["primary", "Hauptfarbe", "Buttons, Links und primäre Aktionen"],
  ["secondary", "Sekundärfarbe", "Cyan-/Sekundärakzente"],
  ["background", "Hintergrund", "Globaler App-Hintergrund"],
  ["backgroundElevated", "Erhöhter Hintergrund", "Formulare und erhöhte Flächen"],
  ["card", "Kartenfarbe", "Widgets und Panels"],
  ["sidebar", "Sidebar", "Desktop- und mobile Navigation"],
  ["header", "Header", "Topbar und schwebende Kopfbereiche"],
  ["text", "Haupttext", "Primärer Inhalt"],
  ["textMuted", "Sekundärtext", "Metadaten und Erläuterungen"],
  ["border", "Rahmen", "Trennlinien und Kartenränder"],
  ["info", "Information", "Informationszustände"],
  ["success", "Erfolg", "Erfolgreiche Aktionen"],
  ["open", "Offen", "Offene Vorgänge"],
  ["warning", "Warnung", "Warnungen und offene Fristen"],
  ["error", "Fehler", "Fehler und kritische Zustände"],
  ["penalty", "Strafe", "FIA-Strafen"],
  ["archived", "Archiviert", "Archivierte Inhalte"],
  ["live", "Live", "Live- und Online-Zustände"],
  ["admin", "Admin", "Administrationsrollen"],
  ["steward", "Steward", "Steward-Rollen"],
  ["fia", "FIA", "Race-Control-Akzent"],
  ["teamPrincipal", "Teamchef", "Teamchef-Rollen"],
  ["firstPlace", "Platz 1", "Sieger und WM-Führung"],
  ["secondPlace", "Platz 2", "Zweiter Platz"],
  ["thirdPlace", "Platz 3", "Dritter Platz"],
  ["fastestLap", "Schnellste Runde", "Fastest-Lap-Markierung"],
  ["positionGain", "Positionsgewinn", "Positive Trends"],
  ["positionLoss", "Positionsverlust", "Negative Trends"],
  ["fiaOpen", "FIA offen", "Offene Tickets"],
  ["fiaReview", "FIA in Bearbeitung", "Laufende Untersuchung"],
  ["fiaVoting", "FIA Abstimmung", "Offene Abstimmungen"],
  ["fiaAccepted", "FIA angenommen", "Angenommene Vorschläge"],
  ["fiaRejected", "FIA abgelehnt", "Abgelehnte Vorschläge"],
  ["fiaTie", "FIA unentschieden", "Gleichstand"],
  ["fiaResolved", "FIA erledigt", "Abgeschlossene Tickets"],
  ["fiaArchived", "FIA archiviert", "Archivierte Tickets"],
];

const pageFields: Array<[keyof PageAccents, string]> = [
  ["dashboard", "Dashboard"],
  ["calendar", "Kalender"],
  ["raceWeekend", "Rennwochenende"],
  ["attendance", "Rennanmeldung"],
  ["results", "Ergebnisse"],
  ["championship", "Meisterschaft"],
  ["fia", "FIA"],
  ["drivers", "Fahrer"],
  ["teams", "Teams"],
  ["notifications", "Benachrichtigungen"],
  ["administration", "Administration"],
];

function ActionFeedback({ state }: { state: DesignActionState }) {
  if (state.status === "idle") return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        state.status === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/30 bg-red-500/10 text-red-200"
      }`}
      role="status"
    >
      <p className="font-semibold">{state.message}</p>
      {state.warnings?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {state.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export default function DesignBrandingEditor({ data }: { data: AdminData }) {
  const [config, setConfig] = useState(data.config);
  const [previewMode, setPreviewMode] = useState<"DARK" | "LIGHT">(
    data.config.defaultMode === "LIGHT" ? "LIGHT" : "DARK",
  );
  const [previewViewport, setPreviewViewport] = useState<"DESKTOP" | "TABLET" | "MOBILE">("DESKTOP");
  const [importError, setImportError] = useState("");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [draftState, draftAction, draftPending] = useActionState(
    saveDesignDraftAction,
    initialDesignActionState,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishDesignAction,
    initialDesignActionState,
  );
  const warnings = useMemo(() => themeContrastWarnings(config), [config]);
  const previewStyle = useMemo(
    () => themeCssVariables(config, previewMode) as React.CSSProperties,
    [config, previewMode],
  );
  const payload = JSON.stringify(config);

  function selectPreset(preset: DesignPreset) {
    setConfig(structuredClone(themePresets[preset]));
  }

  function setToken(mode: "darkTokens" | "lightTokens", key: keyof ThemeTokens, value: string) {
    setConfig((current) => ({
      ...current,
      preset: "CUSTOM",
      [mode]: { ...current[mode], [key]: value.toUpperCase() },
    }));
  }

  function resetToken(mode: "darkTokens" | "lightTokens", key: keyof ThemeTokens) {
    const preset = config.preset === "CUSTOM" ? "FRL_RACING_BLUE" : config.preset;
    setToken(mode, key, themePresets[preset][mode][key]);
  }

  function setAccent(key: keyof PageAccents, value: string) {
    setConfig((current) => ({
      ...current,
      preset: "CUSTOM",
      pageAccents: { ...current.pageAccents, [key]: value.toUpperCase() },
    }));
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "frl-design-theme.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importConfig(file: File | undefined) {
    if (!file || file.size > 250_000) return;
    try {
      const parsed = designThemeConfigSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setImportError("Die importierte Datei entspricht keinem gültigen FRL-Theme.");
        return;
      }
      setConfig(parsed.data);
      setImportError("");
    } catch {
      setImportError("Die importierte JSON-Datei konnte nicht gelesen werden.");
    }
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_32rem]">
      <div className="min-w-0 space-y-6">
        <details className="surface-panel lg:hidden">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between px-5 font-bold">
            Mobile Live-Vorschau
            <Palette size={18} className="text-[var(--color-primary)]" />
          </summary>
          <div className="border-t border-[var(--color-border)] p-3">
            <PreviewViewportToggle value={previewViewport} onChange={setPreviewViewport} />
            <div className="mt-3"><DesignPreview config={config} mode={previewMode} style={previewStyle} viewport={previewViewport} /></div>
          </div>
        </details>
        <section className="surface-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Designsteuerung</p>
              <h2 className="mt-2 text-2xl font-black">Theme konfigurieren</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Aktiv: {data.activeThemeName} · {data.isDraft ? "Entwurf geladen" : "Veröffentlichtes Theme geladen"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="wizard-secondary-button" onClick={exportConfig}>
                <Download size={16} /> Export
              </button>
              <button type="button" className="wizard-secondary-button" onClick={() => importRef.current?.click()}>
                <Upload size={16} /> Import
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void importConfig(event.target.files?.[0])}
              />
            </div>
          </div>
          {importError ? <p className="mt-3 text-sm text-red-300">{importError}</p> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(themePresets) as DesignPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className={`min-h-20 rounded-2xl border p-4 text-left transition ${
                  config.preset === preset
                    ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)]"
                    : "border-[var(--color-border)] bg-[var(--color-background-elevated)] hover:border-[var(--color-primary)]"
                }`}
              >
                <span className="block font-bold">{designPresetLabels[preset]}</span>
                <span className="mt-2 flex gap-1">
                  <i className="size-3 rounded-full" style={{ background: themePresets[preset].darkTokens.primary }} />
                  <i className="size-3 rounded-full" style={{ background: themePresets[preset].darkTokens.secondary }} />
                  <i className="size-3 rounded-full" style={{ background: themePresets[preset].darkTokens.card }} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <BackgroundEditor config={config} setConfig={setConfig} themeId={data.themeId} mode={previewMode} />

        <section className="surface-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Globale Farben</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Dark und Light werden getrennt gepflegt.</p>
            </div>
            <div className="flex rounded-xl border border-[var(--color-border)] p-1">
              {(["DARK", "LIGHT"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${previewMode === mode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}
                >
                  {mode === "DARK" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {tokenFields.map(([key, label, description]) => {
              const collection = previewMode === "DARK" ? "darkTokens" : "lightTokens";
              const value = config[collection][key];
              return (
                <label key={key} className="grid grid-cols-[3rem_minmax(0,1fr)_7rem_auto] items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-3">
                  <input type="color" value={value} onChange={(event) => setToken(collection, key, event.target.value)} className="size-11 cursor-pointer rounded-lg border-0 bg-transparent" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{description}</span>
                  </span>
                  <input value={value} onChange={(event) => setToken(collection, key, event.target.value)} maxLength={7} className="form-control min-h-9 px-2 py-1 font-mono text-xs" aria-label={`${label} Hex-Wert`} />
                  <button type="button" onClick={() => resetToken(collection, key)} className="flex size-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-card)] hover:text-[var(--color-text)]" aria-label={`${label} zurücksetzen`}><RotateCcw size={14} /></button>
                </label>
              );
            })}
          </div>
        </section>

        <section className="surface-panel p-5 sm:p-6">
          <h2 className="text-xl font-black">Seitenspezifische Akzente</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Akzentlinien, Icons und Highlights bleiben innerhalb des globalen Systems.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pageFields.map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-3">
                <input type="color" value={config.pageAccents[key]} onChange={(event) => setAccent(key, event.target.value)} className="size-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                <span className="font-semibold">{label}</span>
                <code className="ml-auto text-xs text-[var(--color-text-muted)]">{config.pageAccents[key]}</code>
              </label>
            ))}
          </div>
        </section>

        <SurfaceSettings config={config} setConfig={setConfig} />
        <ExperienceSettings config={config} setConfig={setConfig} />
        <LeagueTeamSettings leagues={data.leagues} teams={data.teams} />

        <section className="surface-panel p-5 sm:p-6">
          <h2 className="text-xl font-black">Versionen</h2>
          <div className="mt-4 space-y-2">
            {data.versions.length ? data.versions.map((version) => (
              <div key={version.id} className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{version.themeName} · Version {version.version}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{version.createdBy} · {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt))}</p>
                </div>
                <form action={restoreDesignVersionAction.bind(null, version.id)}>
                  <button className="wizard-secondary-button">Als Entwurf laden</button>
                </form>
              </div>
            )) : <p className="text-sm text-[var(--color-text-muted)]">Noch keine veröffentlichte Version.</p>}
          </div>
        </section>

        <div className="space-y-3">
          <ActionFeedback state={draftState} />
          <ActionFeedback state={publishState} />
          {warnings.length ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-bold">Kontrastwarnungen</p>
              <p className="mt-1">Diese Farbkombination besitzt nicht genügend Kontrast.</p>
              <ul className="mt-2 list-disc pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              <label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-amber-400/25 px-3"><input type="checkbox" checked={acknowledgeWarnings} onChange={(event) => setAcknowledgeWarnings(event.target.checked)} />Warnungen geprüft und Veröffentlichung bestätigen</label>
            </div>
          ) : null}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4 text-sm text-[var(--color-text-muted)]">
            <strong className="text-[var(--color-text)]">Änderungsübersicht:</strong> {designPresetLabels[config.preset]} · Standard {config.defaultMode} · {Object.keys(config.pageAccents).length} Bereichsakzente · {config.componentSettings.density.toLowerCase()}e Dichte
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <form action={draftAction}>
              <input type="hidden" name="themePayload" value={payload} />
              <button disabled={draftPending} className="wizard-secondary-button w-full sm:w-auto">{draftPending ? "Speichert…" : "Entwurf speichern"}</button>
            </form>
            <form action={publishAction}>
              <input type="hidden" name="themePayload" value={payload} />
              <input type="hidden" name="acknowledgeWarnings" value={acknowledgeWarnings ? "true" : "false"} />
              <button disabled={publishPending || (warnings.length > 0 && !acknowledgeWarnings)} className="wizard-primary-button w-full sm:w-auto">{publishPending ? "Veröffentlicht…" : "Design veröffentlichen"}</button>
            </form>
            <button type="button" onClick={() => setConfig(data.config)} className="wizard-secondary-button"><RotateCcw size={16} /> Änderungen verwerfen</button>
            <form action={restoreDefaultDesignAction}>
              <button className="danger-button">FRL-Standard wiederherstellen</button>
            </form>
          </div>
        </div>
      </div>

      <aside className="hidden lg:block 2xl:sticky 2xl:top-24 2xl:self-start">
        <PreviewViewportToggle value={previewViewport} onChange={setPreviewViewport} />
        <div className="mt-3"><DesignPreview config={config} mode={previewMode} style={previewStyle} viewport={previewViewport} /></div>
      </aside>
    </div>
  );
}

function SurfaceSettings({ config, setConfig }: { config: DesignThemeConfig; setConfig: React.Dispatch<React.SetStateAction<DesignThemeConfig>> }) {
  const settings = config.componentSettings;
  function update<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setConfig((current) => ({ ...current, preset: "CUSTOM", componentSettings: { ...current.componentSettings, [key]: value } }));
  }
  return (
    <section className="surface-panel p-5 sm:p-6">
      <h2 className="text-xl font-black">Oberflächen & Dichte</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Select label="Standardschrift" value={settings.baseFont} options={["SYSTEM", "MODERN", "HUMANIST"]} onChange={(value) => update("baseFont", value as typeof settings.baseFont)} />
        <Select label="Überschriftenschrift" value={settings.headingFont} options={["INHERIT", "CONDENSED", "TECHNICAL"]} onChange={(value) => update("headingFont", value as typeof settings.headingFont)} />
        <Select label="Zahlen- & Timing-Schrift" value={settings.numberFont} options={["SYSTEM_MONO", "CASCADE", "TABULAR"]} onChange={(value) => update("numberFont", value as typeof settings.numberFont)} />
        <Select label="Eckenradius" value={settings.radius} options={["SHARP", "SOFT", "ROUNDED"]} onChange={(value) => update("radius", value as typeof settings.radius)} />
        <Select label="Schatten" value={settings.shadow} options={["NONE", "SUBTLE", "MEDIUM", "STRONG"]} onChange={(value) => update("shadow", value as typeof settings.shadow)} />
        <Select label="Glow" value={settings.glow} options={["NONE", "SUBTLE", "STRONG"]} onChange={(value) => update("glow", value as typeof settings.glow)} />
        <Select label="Kartenkontrast" value={settings.cardContrast} options={["LOW", "NORMAL", "HIGH"]} onChange={(value) => update("cardContrast", value as typeof settings.cardContrast)} />
        <Select label="Rahmenstil" value={settings.borderStyle} options={["NONE", "SUBTLE", "ACCENT"]} onChange={(value) => update("borderStyle", value as typeof settings.borderStyle)} />
        <Select label="Kartendarstellung" value={settings.cardBackground} options={["SOLID", "GRADIENT", "TEXTURE"]} onChange={(value) => update("cardBackground", value as typeof settings.cardBackground)} />
        <Select label="Textur" value={settings.texture} options={["NONE", "CARBON", "RACING_GRID", "CHECKERED", "TRACK_LINES", "CONTROL_GRID", "GRADIENT"]} onChange={(value) => update("texture", value as typeof settings.texture)} />
        <Select label="Texturbereich" value={settings.textureScope} options={["HERO", "PAGES", "RACES"]} onChange={(value) => update("textureScope", value as typeof settings.textureScope)} />
        <Select label="Dichte" value={settings.density} options={["COMPACT", "STANDARD", "COMFORTABLE"]} onChange={(value) => update("density", value as typeof settings.density)} />
        <Select label="Typografiedichte" value={settings.typographyDensity} options={["COMPACT", "STANDARD", "SPACIOUS"]} onChange={(value) => update("typographyDensity", value as typeof settings.typographyDensity)} />
        <Select label="Hero-Stil" value={settings.heroStyle} options={["CINEMATIC", "RACE_CONTROL", "MINIMAL", "COMPACT"]} onChange={(value) => update("heroStyle", value as typeof settings.heroStyle)} />
        <Select label="Überschriftenstärke" value={settings.headingWeight} options={["700", "800", "900"]} onChange={(value) => update("headingWeight", value as typeof settings.headingWeight)} />
        <Select label="Zahlenstärke" value={settings.numberWeight} options={["600", "700", "800", "900"]} onChange={(value) => update("numberWeight", value as typeof settings.numberWeight)} />
        <Select label="Code-Laufweite" value={settings.codeLetterSpacing} options={["NORMAL", "WIDE", "EXTRA_WIDE"]} onChange={(value) => update("codeLetterSpacing", value as typeof settings.codeLetterSpacing)} />
        <Range label="Texturintensität" value={settings.textureIntensity} min={0} max={30} suffix="%" onChange={(value) => update("textureIntensity", value)} />
        <Range label="Hero-Overlay" value={settings.heroOverlay} min={20} max={90} suffix="%" onChange={(value) => update("heroOverlay", value)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Check label="Hero-Glow" checked={settings.heroGlow} onChange={(value) => update("heroGlow", value)} />
        <Check label="Track Layout" checked={settings.showTrackLayout} onChange={(value) => update("showTrackLayout", value)} />
        <Check label="Teamlogo" checked={settings.showTeamLogo} onChange={(value) => update("showTeamLogo", value)} />
        <Check label="Landesflagge" checked={settings.showCountryFlag} onChange={(value) => update("showCountryFlag", value)} />
        <Check label="Countdown" checked={settings.showCountdown} onChange={(value) => update("showCountdown", value)} />
        <Check label="Motorsport-Headlines" checked={settings.uppercaseHeadings} onChange={(value) => update("uppercaseHeadings", value)} />
      </div>
    </section>
  );
}

const mobileNavigationOptions = [
  "dashboard",
  "calendar",
  "attendance",
  "championship",
  "fia",
  "notifications",
  "drivers",
  "teams",
] as const;

function ExperienceSettings({ config, setConfig }: { config: DesignThemeConfig; setConfig: React.Dispatch<React.SetStateAction<DesignThemeConfig>> }) {
  const navigation = config.navigationSettings;
  function updateNavigation<K extends keyof typeof navigation>(key: K, value: (typeof navigation)[K]) {
    setConfig((current) => ({ ...current, preset: "CUSTOM", navigationSettings: { ...current.navigationSettings, [key]: value } }));
  }
  function updateRoot<K extends "defaultMode" | "allowDarkMode" | "allowLightMode" | "allowSystemMode" | "allowUserModeOverride">(key: K, value: DesignThemeConfig[K]) {
    setConfig((current) => ({ ...current, preset: "CUSTOM", [key]: value }));
  }
  function moveMobileItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= navigation.mobileItems.length) return;
    const mobileItems = [...navigation.mobileItems];
    [mobileItems[index], mobileItems[nextIndex]] = [mobileItems[nextIndex], mobileItems[index]];
    updateNavigation("mobileItems", mobileItems);
  }
  function replaceMobileItem(index: number, value: (typeof mobileNavigationOptions)[number]) {
    if (navigation.mobileItems.includes(value)) return;
    const mobileItems = [...navigation.mobileItems];
    mobileItems[index] = value;
    updateNavigation("mobileItems", mobileItems);
  }

  return (
    <section className="surface-panel p-5 sm:p-6">
      <h2 className="text-xl font-black">Farbmodus & Navigation</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Darstellungsoptionen ändern niemals Rollen oder Berechtigungen.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Select label="Standardmodus" value={config.defaultMode} options={["DARK", "LIGHT", "SYSTEM"]} onChange={(value) => updateRoot("defaultMode", value as DesignThemeConfig["defaultMode"])} />
        <Select label="Sidebarbreite" value={navigation.sidebarWidth} options={["COMPACT", "WIDE"]} onChange={(value) => updateNavigation("sidebarWidth", value as typeof navigation.sidebarWidth)} />
        <Select label="Logogröße" value={navigation.logoSize} options={["SMALL", "MEDIUM", "LARGE"]} onChange={(value) => updateNavigation("logoSize", value as typeof navigation.logoSize)} />
        <Select label="Aktiver Menüpunkt" value={navigation.activeStyle} options={["SURFACE", "LINE", "GLOW", "COMBINED"]} onChange={(value) => updateNavigation("activeStyle", value as typeof navigation.activeStyle)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Check label="Dark Mode erlauben" checked={config.allowDarkMode} onChange={(value) => updateRoot("allowDarkMode", value)} />
        <Check label="Light Mode erlauben" checked={config.allowLightMode} onChange={(value) => updateRoot("allowLightMode", value)} />
        <Check label="Systemmodus erlauben" checked={config.allowSystemMode} onChange={(value) => updateRoot("allowSystemMode", value)} />
        <Check label="Nutzerwahl erlauben" checked={config.allowUserModeOverride} onChange={(value) => updateRoot("allowUserModeOverride", value)} />
        <Check label="Sidebar einklappbar" checked={navigation.collapsible} onChange={(value) => updateNavigation("collapsible", value)} />
        <Check label="Navigationsgruppen" checked={navigation.grouped} onChange={(value) => updateNavigation("grouped", value)} />
        <Check label="Mobile Bottom Navigation" checked={navigation.mobileBottomNavigation} onChange={(value) => updateNavigation("mobileBottomNavigation", value)} />
      </div>
      <div className="mt-5">
        <p className="eyebrow">Mobile Hauptpunkte</p>
        <div className="mt-3 space-y-2">
          {navigation.mobileItems.map((item, index) => (
            <div key={`${item}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
              <select value={item} onChange={(event) => replaceMobileItem(index, event.target.value as (typeof mobileNavigationOptions)[number])} className="form-control">
                {mobileNavigationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <button type="button" aria-label={`${item} nach oben`} onClick={() => moveMobileItem(index, -1)} disabled={index === 0} className="wizard-secondary-button px-3">↑</button>
              <button type="button" aria-label={`${item} nach unten`} onClick={() => moveMobileItem(index, 1)} disabled={index === navigation.mobileItems.length - 1} className="wizard-secondary-button px-3">↓</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LeagueTeamSettings({ leagues, teams }: Pick<AdminData, "leagues" | "teams">) {
  return (
    <section className="surface-panel p-5 sm:p-6">
      <h2 className="text-xl font-black">Liga- & Teamfarben</h2>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="space-y-2">
          <p className="eyebrow">Ligen F1–F6</p>
          {leagues.map((league) => (
            <form key={league.id} action={updateLeagueBrandingAction} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3">
              <input type="hidden" name="leagueId" value={league.id} />
              <input type="color" name="color" defaultValue={league.color ?? "#3B82F6"} className="size-10" />
              <span className="min-w-0 flex-1"><strong>{league.code}</strong><small className="ml-2 text-[var(--color-text-muted)]">{league.name}</small></span>
              <button className="wizard-secondary-button min-h-9 px-3 py-1">Speichern</button>
            </form>
          ))}
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Aktive Teams</p>
          {teams.map((team) => (
            <form key={team.id} action={updateTeamBrandingAction} className="grid gap-3 rounded-xl border border-[var(--color-border)] p-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-center">
              <input type="hidden" name="teamId" value={team.id} />
              <input aria-label={`${team.name} Primärfarbe`} type="color" name="color" defaultValue={team.color} className="size-10" />
              <input aria-label={`${team.name} Sekundärfarbe`} type="color" name="secondaryColor" defaultValue={team.secondaryColor ?? team.color} className="size-10" />
              <span className="min-w-0 truncate"><strong>{team.shortName}</strong><small className="ml-2 text-[var(--color-text-muted)]">{team.name}</small></span>
              <button className="wizard-secondary-button min-h-9 px-3 py-1">Speichern</button>
              <p className="text-xs text-[var(--color-text-muted)] sm:col-span-3">
                Das Teamlogo wird sicher in der Teamverwaltung hochgeladen.
              </p>
            </form>
          ))}
        </div>
      </div>
    </section>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="master-label">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="form-control mt-2">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4" />{label}</label>;
}

function Range({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="master-label">{label} <span className="text-[var(--color-text-muted)]">{value}{suffix}</span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[var(--color-primary)]" /></label>;
}

function PreviewViewportToggle({ value, onChange }: { value: "DESKTOP" | "TABLET" | "MOBILE"; onChange: (value: "DESKTOP" | "TABLET" | "MOBILE") => void }) {
  return <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] p-1">{([['DESKTOP', 'Desktop'], ['TABLET', 'Tablet'], ['MOBILE', 'Smartphone']] as const).map(([viewport, label]) => <button key={viewport} type="button" onClick={() => onChange(viewport)} className={`min-h-11 rounded-lg px-2 text-xs font-bold ${value === viewport ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}>{label}</button>)}</div>;
}

function DesignPreview({ config, mode, style, viewport }: { config: DesignThemeConfig; mode: "DARK" | "LIGHT"; style: React.CSSProperties; viewport: "DESKTOP" | "TABLET" | "MOBILE" }) {
  const viewportClass = viewport === "MOBILE" ? "max-w-[23rem]" : viewport === "TABLET" ? "max-w-[30rem]" : "max-w-full";
  return (
    <section className={`relative isolate mx-auto w-full ${viewportClass} overflow-hidden rounded-[1.5rem] border border-slate-700 shadow-2xl`} data-preview-viewport={viewport.toLowerCase()} style={{ ...style, background: mode === "DARK" ? config.darkTokens.background : config.lightTokens.background, color: mode === "DARK" ? config.darkTokens.text : config.lightTokens.text }}>
      <AppBackground settings={config.backgroundSettings} mode={mode} preview />
      <div className="relative z-10">
      <header className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-header)" }}>
        <span className="flex items-center gap-2 font-black"><Palette size={18} style={{ color: "var(--color-primary)" }} /> FRL Preview</span>
        <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase" style={{ color: "var(--color-success)", background: "color-mix(in srgb,var(--color-success) 14%,transparent)" }}>System online</span>
      </header>
      <div className="p-4">
        <div className="relative overflow-hidden rounded-2xl border p-5" style={{ borderColor: "var(--accent-race-weekend)", background: "linear-gradient(135deg,color-mix(in srgb,var(--accent-race-weekend) 20%,var(--color-card)),var(--color-card))" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--accent-race-weekend)" }}>Race weekend</p>
          <h3 className="mt-2 text-2xl font-black">Belgian Grand Prix</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>Spa-Francorchamps · Runde 08</p>
          <div className="mt-4 flex items-center gap-3"><Gauge size={26} style={{ color: "var(--color-secondary)" }} /><span className="font-mono text-xl font-black">02:14:38</span></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['WM', 'P03'], ['Punkte', '128'], ['Siege', '02']].map(([label, value]) => <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}><p className="text-[9px] uppercase" style={{ color: "var(--color-text-muted)" }}>{label}</p><strong className="mt-1 block text-xl">{value}</strong></div>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold"><span className="rounded-full px-2 py-1" style={{ color: "var(--color-success)", background: "color-mix(in srgb,var(--color-success) 14%,transparent)" }}><CheckCircle2 className="mr-1 inline" size={11} />Erledigt</span><span className="rounded-full px-2 py-1" style={{ color: "var(--color-fia)", background: "color-mix(in srgb,var(--color-fia) 14%,transparent)" }}><ShieldAlert className="mr-1 inline" size={11} />FIA offen</span></div>
        <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: "var(--color-border)" }}><div className="grid grid-cols-[2rem_1fr_auto] gap-2 p-3 text-xs" style={{ background: "var(--color-background-elevated)" }}><span>1</span><strong className="inline-flex items-center gap-2"><CountryFlag countryCode="DE" size="sm" />Max Mustermann</strong><span style={{ color: "var(--color-position-1)" }}>156 Pkt.</span></div><div className="grid grid-cols-[2rem_1fr_auto] gap-2 border-t p-3 text-xs" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}><span>2</span><strong className="inline-flex items-center gap-2"><CountryFlag countryCode="AT" size="sm" />Alex Racing</strong><span>149 Pkt.</span></div></div>
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--color-fia)", background: "color-mix(in srgb,var(--color-fia) 9%,var(--color-card))" }}><p className="text-xs font-black" style={{ color: "var(--color-fia)" }}>⚖ FIA Strafenvorschlag</p><p className="mt-1 text-xs">+10 Sekunden · Abstimmung läuft</p></div>
        <div className="mt-3 flex gap-2"><button className="flex-1 rounded-xl px-3 py-2 text-xs font-black text-white" style={{ background: "var(--color-primary)" }}>Primäraktion</button><button className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--color-border)" }}><Eye size={14} /></button></div>
        <label className="mt-3 block text-[10px] font-bold">Formularfeld<input readOnly value="Vorschau" className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-xs" style={{ borderColor: "var(--color-border)" }} /></label>
        <div className="mt-3 flex items-center justify-center rounded-xl border border-dashed p-5" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}><Flag className="mr-2" size={18} /> Track Layout Platzhalter</div>
      </div>
      </div>
    </section>
  );
}
