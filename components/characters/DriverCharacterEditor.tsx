"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, RotateCcw, Save, ShieldCheck, ZoomIn, ZoomOut } from "lucide-react";
import DriverCharacter, { type DriverCharacterVariant } from "./DriverCharacter";
import CharacterSelect from "./CharacterSelect";
import TeamLogo from "@/components/teams/TeamLogo";
import {
  backgrounds,
  beardStyles,
  bodyShapes,
  cheekStyles,
  eyeColors,
  eyeShapes,
  eyebrowStyles,
  eyewearStyles,
  faceDetails,
  faceShapes,
  hairColors,
  hairStyles,
  helmetModes,
  helmetPatterns,
  helmetStyles,
  jawStyles,
  mouthStyles,
  normalPoses,
  noseStyles,
  skinTones,
  winnerPoses,
  type DriverCharacterConfiguration,
} from "@/lib/characters/schema";
import { resetDriverCharacterAction, saveDriverCharacterAction, type CharacterActionState } from "@/lib/characters/actions";
import type { DriverCharacterView, TeamSuitView } from "@/lib/characters/types";

type EditorData = {
  displayName: string;
  driver: { name: string; number: number; flag: string } | null;
  organization: { id: number; name: string; color: string; logoUrl: string | null } | null;
  character: DriverCharacterView;
  selectedSuit: TeamSuitView;
  templates: TeamSuitView[];
};

type Category = "FACE" | "HAIR" | "BEARD" | "BODY" | "DETAILS";
type PreviewMode = Extract<DriverCharacterVariant, "head" | "halfBody" | "fullBody">;

const categories: Array<{ value: Category; label: string; description: string }> = [
  { value: "FACE", label: "Gesicht", description: "Form, Kiefer, Wangen und Merkmale" },
  { value: "HAIR", label: "Haare", description: "Schnitt, Volumen und natürliche Farben" },
  { value: "BEARD", label: "Bart", description: "Stoppeln, Bartformen und Details" },
  { value: "BODY", label: "Körper", description: "Statur und offizielle Fahrerpose" },
  { value: "DETAILS", label: "Details", description: "Brille, Helm und Rennsportdetails" },
];

const labels: Record<string, string> = {
  SLIM: "Slim", REGULAR: "Standard", ATHLETIC: "Athletic", STRONG: "Broad",
  OVAL: "Oval", ROUND: "Rund", ANGULAR: "Kantig", NARROW: "Schmal", WIDE: "Breit",
  SOFT: "Weich", DEFINED: "Definiert", SQUARE: "Markant", TAPERED: "Schmal zulaufend",
  BALANCED: "Ausgewogen", LEAN: "Schlank", SCULPTED: "Konturiert", FULL: "Voll",
  BUZZ: "Buzz Cut", FADE: "Fade", SHORT_FADE: "Short Fade", SHORT: "Kurz", TEXTURED_CROP: "Textured Crop", SIDE_PART: "Side Part", CURLY_SHORT: "Kurze Locken", CURLY: "Lockig", WAVY: "Wellig", MEDIUM: "Mittellang", LONG: "Lang", STRAIGHT: "Gerade / glatt", UNDERCUT: "Undercut", SLICKED: "Slick Back", AFRO: "Afro", BALD: "Glatze",
  NONE: "Keine", LIGHT: "Leichter Bartschatten", STUBBLE: "Stoppeln", HEAVY_STUBBLE: "Starke Stoppeln", SHORT_FULL: "Kurzer Vollbart", LONG_FULL: "Langer Vollbart", MOUSTACHE: "Schnurrbart", GOATEE: "Kinnbart",
  ALMOND: "Mandelförmig", DEEP: "Tief liegend", BROWN: "Braun", DARK_BROWN: "Dunkelbraun", BLUE: "Blau", GREEN: "Grün", GRAY: "Grau", HAZEL: "Hasel",
  BOLD: "Kräftig", NEUTRAL: "Neutral", SMILE: "Leichtes Lächeln", FOCUSED: "Fokussiert", CONFIDENT: "Selbstbewusst",
  GLASSES: "Brille", SUNGLASSES: "Sonnenbrille", FRECKLES: "Sommersprossen", CHEEK_MARK: "Wangenmerkmal", BROW_MARK: "Augenbrauenmerkmal",
  ARMS_CROSSED: "Arme verschränkt", HANDS_ON_HIPS: "Hände an Hüfte", HELM_UNDER_ARM: "Helm unterm Arm", THUMBS_UP: "Daumen hoch",
  FIST_UP: "Faust nach oben", BOTH_ARMS_UP: "Beide Arme oben", TROPHY: "Pokal", CHAMPAGNE: "Champagner", POINT_NUMBER_ONE: "Nummer eins", HELM_UP: "Helm hoch",
  TEAM: "Teamfarbe", BLACK: "Schwarz", WHITE: "Weiß", MODERN: "Modern", CLASSIC: "Klassisch", COMPACT: "Kompakt",
  STRIPES: "Streifen", CHEVRON: "Chevron", GEOMETRIC: "Geometrisch", SPLIT: "Geteilt", OFF: "Ohne Helm", CARRIED: "Getragen", WORN_OPEN: "Aufgesetzt, offen", WORN_CLOSED: "Aufgesetzt, geschlossen",
  MATTE: "Matt", GLOSS: "Glänzend", FRL_BLUE: "FRL Blue", TEAM_GLOW: "Team Glow", GRID: "Startaufstellung", PIT_WALL: "Pit Wall",
};

const skinSwatches: Record<(typeof skinTones)[number], string> = { TONE_1: "#EEC9B0", TONE_2: "#DDB496", TONE_3: "#C99673", TONE_4: "#AE7655", TONE_5: "#915B40", TONE_6: "#70432F", TONE_7: "#513225", TONE_8: "#38241B" };
const hairSwatches: Record<(typeof hairColors)[number], string> = { BLACK: "#171A20", DARK_BROWN: "#302018", BROWN: "#573824", LIGHT_BROWN: "#79583B", BLOND: "#BE9B5F", RED: "#783A29", GRAY: "#7D828A", WHITE: "#D8DCE1" };
const eyeSwatches: Record<(typeof eyeColors)[number], string> = { BROWN: "#74452F", DARK_BROWN: "#35221C", BLUE: "#477FA5", GREEN: "#52765A", GRAY: "#77838D", HAZEL: "#81713F" };

function snapshot(configuration: DriverCharacterConfiguration, normalPose: string, winnerPose: string): string {
  return JSON.stringify({ configuration, normalPose, winnerPose });
}

export default function DriverCharacterEditor({ data }: { data: EditorData }) {
  const [configuration, setConfiguration] = useState(data.character.configuration);
  const [normalPose, setNormalPose] = useState(data.character.normalPose);
  const [winnerPose, setWinnerPose] = useState(data.character.winnerPose);
  const [activeCategory, setActiveCategory] = useState<Category>("FACE");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("fullBody");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [message, setMessage] = useState<CharacterActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(data.character.configuration, data.character.normalPose, data.character.winnerPose));
  const currentSnapshot = useMemo(() => snapshot(configuration, normalPose, winnerPose), [configuration, normalPose, winnerPose]);
  const dirty = currentSnapshot !== savedSnapshot;
  const suit = data.selectedSuit;
  const driverName = data.driver?.name ?? data.displayName;
  const patch = <K extends keyof DriverCharacterConfiguration>(key: K, value: DriverCharacterConfiguration[K]) => {
    setConfiguration((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  useEffect(() => {
    if (!dirty) return;
    const warning = "Du hast ungespeicherte Änderungen an deinem Fahrercharakter.";
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = warning; };
    const linkNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || window.confirm(`${warning} Möchtest du die Seite wirklich verlassen?`)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkNavigation, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", linkNavigation, true); };
  }, [dirty]);

  function save() {
    startTransition(async () => {
      const result = await saveDriverCharacterAction({ configuration, normalPose, winnerPose, suitVariantId: null });
      setMessage(result);
      if (result.status === "success") setSavedSnapshot(currentSnapshot);
    });
  }

  function reset() {
    if (!window.confirm("Deinen persönlichen Charakter wirklich auf den professionellen FRL-Standard zurücksetzen?")) return;
    startTransition(async () => {
      const result = await resetDriverCharacterAction();
      setMessage(result);
      if (result.status === "success") window.location.reload();
    });
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(20rem,.82fr)_minmax(0,1.18fr)] lg:items-start">
      <aside className="min-w-0 lg:sticky lg:top-3 lg:self-start">
        <div className="master-card overflow-hidden p-3 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Live Driver Preview</p>
              <h2 className="mt-1 truncate text-xl font-black text-white">{driverName}</h2>
            </div>
            <span className={`self-start rounded-full border px-3 py-1.5 text-xs font-bold ${dirty ? "border-amber-400/35 bg-amber-400/10 text-amber-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{dirty ? "Ungespeicherte Änderungen" : "Gespeichert"}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Vorschau wählen">
            {(["head", "halfBody", "fullBody"] as const).map((mode) => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} aria-pressed={previewMode === mode} className={`min-h-11 rounded-xl border px-2 text-xs font-bold transition ${previewMode === mode ? "border-blue-400 bg-blue-500/20 text-blue-100" : "border-white/10 bg-slate-950/50 text-slate-400 hover:border-blue-400/50"}`}>{mode === "head" ? "Kopf" : mode === "halfBody" ? "Oberkörper" : "Ganzkörper"}</button>)}
          </div>

          <div className="relative mt-3 flex min-h-[21rem] items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_24%,color-mix(in_srgb,var(--page-accent)_32%,transparent),transparent_46%),linear-gradient(180deg,#111c31,#050b14)] sm:min-h-[26rem]">
            <div className="absolute inset-x-5 top-5 flex items-center justify-between">
              <span className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1.5 text-[.68rem] font-bold uppercase tracking-[.16em] text-slate-300">Official FRL Driver</span>
              <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/65 p-1">
                <button type="button" onClick={() => setPreviewZoom((value) => Math.max(.85, value - .15))} aria-label="Vorschau verkleinern" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-300 hover:bg-white/10"><ZoomOut size={17} /></button>
                <button type="button" onClick={() => setPreviewZoom((value) => Math.min(1.3, value + .15))} aria-label="Vorschau vergrößern" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-300 hover:bg-white/10"><ZoomIn size={17} /></button>
              </div>
            </div>
            <DriverCharacter configuration={configuration} teamSuit={suit.configuration} pose={normalPose} driverNumber={data.driver?.number} driverInitials={driverName} teamLogoUrl={data.organization?.logoUrl} variant={previewMode} alt={`Live-Vorschau für ${driverName}`} className={previewMode === "fullBody" ? "h-[22rem] max-w-full sm:h-[25rem]" : previewMode === "halfBody" ? "h-[21rem] max-w-full sm:h-[24rem]" : "h-[18rem] max-w-full sm:h-[21rem]"} showBackground style={{ transform: `scale(${previewZoom})`, transformOrigin: "bottom center", transition: "transform 180ms ease" }} />
          </div>

          <div className="mt-4 flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3">
            <TeamLogo logoUrl={data.organization?.logoUrl ?? null} teamName={data.organization?.name ?? "FRL"} shortName={data.organization?.name?.slice(0, 3) ?? "FRL"} primaryColor={data.organization?.color ?? "#168BFF"} size="sm" />
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{data.organization?.name ?? "FRL Standardanzug"}</p><p className="mt-0.5 text-xs text-slate-400">Team, Logo und #{data.driver?.number ?? "–"} werden automatisch übernommen.</p></div>
            <ShieldCheck className="ml-auto shrink-0 text-emerald-300" size={20} />
          </div>
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="master-card p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Editor-Kategorien">
            {categories.map((category) => <button key={category.value} type="button" onClick={() => setActiveCategory(category.value)} aria-pressed={activeCategory === category.value} className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold transition ${activeCategory === category.value ? "border-blue-400 bg-blue-500/20 text-white shadow-lg shadow-blue-950/20" : "border-white/10 bg-slate-950/45 text-slate-400 hover:border-blue-400/45 hover:text-white"}`}>{category.label}</button>)}
          </div>
          <p className="mt-3 text-sm text-slate-400">{categories.find((category) => category.value === activeCategory)?.description}</p>
        </div>

        {activeCategory === "FACE" ? <EditorSection eyebrow="Identity" title="Gesicht modellieren" description="Erwachsene Proportionen mit eigenständiger Silhouette, natürlichen Augen und klarer Kieferlinie.">
          <CharacterPreviewGrid label="Gesichtsform" values={faceShapes} value={configuration.faceShape} configuration={configuration} teamSuit={suit} makeConfiguration={(item) => ({ ...configuration, faceShape: item })} onChange={(item) => patch("faceShape", item)} />
          <CharacterPreviewGrid label="Kiefer" values={jawStyles} value={configuration.jawStyle} configuration={configuration} teamSuit={suit} makeConfiguration={(item) => ({ ...configuration, jawStyle: item })} onChange={(item) => patch("jawStyle", item)} />
          <CharacterPreviewGrid label="Wangen" values={cheekStyles} value={configuration.cheekStyle} configuration={configuration} teamSuit={suit} makeConfiguration={(item) => ({ ...configuration, cheekStyle: item })} onChange={(item) => patch("cheekStyle", item)} />
          <SwatchGrid label="Hautton" values={skinTones} value={configuration.skinTone} colors={skinSwatches} onChange={(item) => patch("skinTone", item)} />
          <CharacterPreviewGrid label="Augenform" values={eyeShapes} value={configuration.eyeShape} configuration={configuration} teamSuit={suit} makeConfiguration={(item) => ({ ...configuration, eyeShape: item })} onChange={(item) => patch("eyeShape", item)} />
          <SwatchGrid label="Augenfarbe" values={eyeColors} value={configuration.eyeColor} colors={eyeSwatches} onChange={(item) => patch("eyeColor", item)} />
          <div className="grid gap-4 sm:grid-cols-3"><Choice label="Augenbrauen" value={configuration.eyebrowStyle} values={eyebrowStyles} onChange={(item) => patch("eyebrowStyle", item)} /><Choice label="Nase" value={configuration.noseStyle} values={noseStyles} onChange={(item) => patch("noseStyle", item)} /><Choice label="Mund" value={configuration.mouthStyle} values={mouthStyles} onChange={(item) => patch("mouthStyle", item)} /></div>
        </EditorSection> : null}

        {activeCategory === "HAIR" ? <EditorSection eyebrow="Hair studio" title="Frisur & Farbe" description="Mehrlagige Silhouetten, Volumen, Schatten und natürliche Motorsport-Looks.">
          <CharacterPreviewGrid label="Frisur" values={hairStyles} value={configuration.hairStyle} configuration={configuration} teamSuit={suit} makeConfiguration={(item) => ({ ...configuration, hairStyle: item })} onChange={(item) => patch("hairStyle", item)} columns="dense" />
          <SwatchGrid label="Haarfarbe" values={hairColors} value={configuration.hairColor} colors={hairSwatches} onChange={(item) => patch("hairColor", item)} />
        </EditorSection> : null}

        {activeCategory === "BEARD" ? <EditorSection eyebrow="Grooming" title="Bart & Gesichtsbehaarung" description="Vom dezenten Bartschatten bis zum klar konturierten Vollbart.">
          <CharacterPreviewGrid label="Bartstil" values={beardStyles} value={configuration.beardStyle} configuration={configuration} teamSuit={suit} makeConfiguration={(item) => ({ ...configuration, beardStyle: item })} onChange={(item) => patch("beardStyle", item)} columns="dense" />
        </EditorSection> : null}

        {activeCategory === "BODY" ? <EditorSection eyebrow="Driver build" title="Körper & Pose" description="Glaubwürdige erwachsene Staturen und eine ruhige offizielle Standardpose.">
          <CharacterPreviewGrid label="Körperbau" values={bodyShapes} value={configuration.bodyShape} configuration={configuration} teamSuit={suit} makeConfiguration={(item) => ({ ...configuration, bodyShape: item })} onChange={(item) => patch("bodyShape", item)} variant="halfBody" />
          <div className="grid gap-4 sm:grid-cols-2"><Choice label="Standardpose" value={normalPose} values={normalPoses} onChange={setNormalPose} /><Choice label="Siegerpose" value={winnerPose} values={winnerPoses} onChange={setWinnerPose} /></div>
          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4"><p className="text-sm font-bold text-blue-100">Rennanzug aus dem FRL-System</p><p className="mt-2 text-sm leading-6 text-slate-400">Der Anzug ist keine persönliche Charaktereigenschaft. Bei einem Teamwechsel wechseln Farben, Logo und Branding automatisch; Gesicht und Körper bleiben erhalten.</p></div>
        </EditorSection> : null}

        {activeCategory === "DETAILS" ? <EditorSection eyebrow="Race details" title="Details, Helm & Ausrüstung" description="Zurückhaltende persönliche Details mit klarem Motorsport-Fokus.">
          <div className="grid gap-4 sm:grid-cols-2"><Choice label="Brille" value={configuration.eyewearStyle} values={eyewearStyles} onChange={(item) => patch("eyewearStyle", item)} /><Choice label="Gesichtsdetail" value={configuration.faceDetail} values={faceDetails} onChange={(item) => patch("faceDetail", item)} /></div>
          <div className="grid gap-4 sm:grid-cols-3"><Choice label="Helmform" value={configuration.helmet.style} values={helmetStyles} onChange={(item) => patch("helmet", { ...configuration.helmet, style: item })} /><Choice label="Helmmuster" value={configuration.helmet.pattern} values={helmetPatterns} onChange={(item) => patch("helmet", { ...configuration.helmet, pattern: item })} /><Choice label="Helmposition" value={configuration.helmet.mode} values={helmetModes} onChange={(item) => patch("helmet", { ...configuration.helmet, mode: item })} /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => <ColorField key={key} label={key === "primaryColor" ? "Helm Hauptfarbe" : key === "secondaryColor" ? "Helm Zweitfarbe" : "Helm Akzent"} value={configuration.helmet[key]} onChange={(value) => patch("helmet", { ...configuration.helmet, [key]: value })} />)}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Choice label="Handschuhe" value={configuration.gloves} values={["TEAM", "BLACK", "WHITE"] as const} onChange={(item) => patch("gloves", item)} /><Choice label="Schuhe" value={configuration.shoes} values={["TEAM", "BLACK", "WHITE"] as const} onChange={(item) => patch("shoes", item)} /><Choice label="Helmfinish" value={configuration.helmet.finish} values={["MATTE", "GLOSS"] as const} onChange={(item) => patch("helmet", { ...configuration.helmet, finish: item })} /></div>
          <div className="grid gap-2 sm:grid-cols-3">{([['showNumber', 'Startnummer'], ['showInitials', 'Initialen'], ['showFlag', 'Flagge']] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-300"><input type="checkbox" checked={configuration.helmet[key]} onChange={(event) => patch("helmet", { ...configuration.helmet, [key]: event.target.checked })} className="size-5" />{label}</label>)}</div>
          <Choice label="Vorschau-Hintergrund" value={configuration.background} values={backgrounds} onChange={(item) => patch("background", item)} />
        </EditorSection> : null}

        <div className="sticky bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-white/10 bg-slate-950/92 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={save} disabled={pending || !dirty} className="wizard-primary-button min-h-12 justify-center"><Save size={18} /> {pending ? "Speichert …" : "Charakter speichern"}</button>
            <button type="button" onClick={reset} disabled={pending} className="wizard-secondary-button min-h-12 justify-center"><RotateCcw size={18} /> Zurücksetzen</button>
            <div className="min-w-0 sm:ml-auto sm:text-right"><p className={`text-sm font-semibold ${message?.status === "error" ? "text-red-300" : dirty ? "text-amber-200" : "text-emerald-300"}`} role="status">{message?.message ?? (dirty ? "Ungespeicherte Änderungen" : "Charakter ist gespeichert.")}</p><p className="mt-0.5 text-xs text-slate-500">Team und Fahrernummer werden nicht als Character-Daten gespeichert.</p></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EditorSection({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="master-card min-w-0 space-y-6"><div><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 text-xl font-black text-white sm:text-2xl">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p></div>{children}</section>;
}

function CharacterPreviewGrid<T extends string>({ label, values, value, configuration, teamSuit, makeConfiguration, onChange, columns = "normal", variant = "head" }: { label: string; values: readonly T[]; value: T; configuration: DriverCharacterConfiguration; teamSuit: TeamSuitView; makeConfiguration: (value: T) => DriverCharacterConfiguration; onChange: (value: T) => void; columns?: "normal" | "dense"; variant?: Extract<DriverCharacterVariant, "head" | "halfBody"> }) {
  return <div><h3 className="mb-3 text-sm font-bold text-slate-200">{label}</h3><div className={`grid gap-2 ${columns === "dense" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>{values.map((item) => <button key={item} type="button" onClick={() => onChange(item)} aria-pressed={value === item} className={`relative min-h-28 overflow-hidden rounded-2xl border p-2 text-left transition ${value === item ? "border-blue-400 bg-blue-500/15 ring-2 ring-blue-400/20" : "border-white/10 bg-slate-950/45 hover:border-blue-400/45"}`}><span className="flex h-20 items-end justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_25%,rgba(59,130,246,.18),transparent_65%)]"><DriverCharacter configuration={makeConfiguration(item)} teamSuit={teamSuit.configuration} variant={variant} alt={`${label}: ${labels[item] ?? item}`} className={variant === "halfBody" ? "h-24 w-auto" : "h-20 w-auto"} showShadow={false} /></span><span className="mt-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-200"><span className="truncate">{labels[item] ?? item.replaceAll("_", " ")}</span>{value === item ? <Check size={15} className="shrink-0 text-blue-300" /> : null}</span></button>)}</div><span className="sr-only">Aktuelle Basiskonfiguration: {configuration.version}</span></div>;
}

function SwatchGrid<T extends string>({ label, values, value, colors, onChange }: { label: string; values: readonly T[]; value: T; colors: Record<T, string>; onChange: (value: T) => void }) {
  return <div><h3 className="mb-3 text-sm font-bold text-slate-200">{label}</h3><div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">{values.map((item) => <button key={item} type="button" onClick={() => onChange(item)} aria-label={`${label}: ${labels[item] ?? item}`} aria-pressed={value === item} className={`relative grid min-h-12 place-items-center rounded-xl border transition ${value === item ? "border-blue-300 bg-blue-500/15 ring-2 ring-blue-400/30" : "border-white/10 bg-slate-950/45 hover:border-blue-400/50"}`}><span className="size-7 rounded-full border border-white/20 shadow-lg" style={{ backgroundColor: colors[item] }} />{value === item ? <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-white"><Check size={12} /></span> : null}</button>)}</div></div>;
}

function Choice<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: readonly T[]; onChange: (value: T) => void }) {
  const id = `character-${label.toLocaleLowerCase("de-DE").replaceAll(/[^a-z0-9]+/g, "-")}`;
  return <CharacterSelect id={id} label={label} value={value} options={values.map((item) => ({ value: item, label: labels[item] ?? item.replaceAll("_", " ") }))} onChange={(next) => onChange(next as T)} />;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span><span className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="size-8 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-xs text-slate-300">{value}</span></span></label>;
}
