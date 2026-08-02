"use client";

import { useMemo, useState, useTransition } from "react";
import { RotateCcw, Save } from "lucide-react";
import DriverCharacter from "./DriverCharacter";
import CharacterSelect from "./CharacterSelect";
import {
  backgrounds, beardStyles, bodyShapes, eyeColors, eyeShapes, eyebrowStyles,
  eyewearStyles, faceDetails, faceShapes, hairColors, hairStyles, helmetModes,
  helmetPatterns, helmetStyles, mouthStyles, normalPoses, noseStyles, skinTones,
  winnerPoses, type DriverCharacterConfiguration,
} from "@/lib/characters/schema";
import { resetDriverCharacterAction, saveDriverCharacterAction } from "@/lib/characters/actions";
import type { DriverCharacterView, TeamSuitView } from "@/lib/characters/types";

type EditorData = {
  displayName: string;
  driver: { name: string; number: number; flag: string } | null;
  organization: { id: number; name: string; color: string } | null;
  character: DriverCharacterView;
  selectedSuit: TeamSuitView;
  templates: TeamSuitView[];
};

const labels: Record<string, string> = {
  SLIM: "Schlank", REGULAR: "Normal", ATHLETIC: "Athletisch", STRONG: "Kräftig",
  OVAL: "Oval", ROUND: "Rund", ANGULAR: "Kantig", NARROW: "Schmal", WIDE: "Breit",
  SHORT: "Kurz", MEDIUM: "Mittel", LONG: "Lang", CURLY: "Lockig", STRAIGHT: "Glatt", UNDERCUT: "Undercut", SIDE_PART: "Seitenscheitel", SLICKED: "Zurückgekämmt", BALD: "Glatze",
  NONE: "Keine", LIGHT: "Leicht", STUBBLE: "Stoppeln", FULL: "Vollbart", MOUSTACHE: "Schnurrbart", GOATEE: "Kinnbart",
  NEUTRAL: "Neutral", ARMS_CROSSED: "Arme verschränkt", HANDS_ON_HIPS: "Hände an Hüfte", HELM_UNDER_ARM: "Helm unterm Arm", THUMBS_UP: "Daumen hoch",
  FIST_UP: "Faust nach oben", BOTH_ARMS_UP: "Beide Arme oben", TROPHY: "Pokal", CHAMPAGNE: "Champagner", POINT_NUMBER_ONE: "Nummer eins", HELM_UP: "Helm hoch",
};

export default function DriverCharacterEditor({ data }: { data: EditorData }) {
  const [configuration, setConfiguration] = useState(data.character.configuration);
  const [normalPose, setNormalPose] = useState(data.character.normalPose);
  const [winnerPose, setWinnerPose] = useState(data.character.winnerPose);
  const [suitVariantId, setSuitVariantId] = useState<number | null>(data.character.suitVariantId);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const suit = useMemo(() => data.templates.find((item) => item.id === suitVariantId) ?? data.selectedSuit, [data, suitVariantId]);
  const patch = <K extends keyof DriverCharacterConfiguration>(key: K, value: DriverCharacterConfiguration[K]) => setConfiguration((current) => ({ ...current, [key]: value }));

  function save() {
    startTransition(async () => {
      const result = await saveDriverCharacterAction({ configuration, normalPose, winnerPose, suitVariantId });
      setMessage(result.message);
    });
  }

  function reset() {
    startTransition(async () => {
      const result = await resetDriverCharacterAction();
      setMessage(result.message);
      if (result.status === "success") window.location.reload();
    });
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.2fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="master-card overflow-hidden p-4 sm:p-6">
          <div className="relative flex min-h-[24rem] items-end justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_28%,rgba(37,99,235,.3),transparent_44%),linear-gradient(180deg,#111c31,#07101f)]">
            <DriverCharacter configuration={configuration} teamSuit={suit.configuration} pose={normalPose} driverNumber={data.driver?.number} driverInitials={data.driver?.name ?? data.displayName} variant="fullBody" alt={`Vorschau für ${data.driver?.name ?? data.displayName}`} className="h-[23rem] max-w-full" showBackground />
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-white">{data.driver?.name ?? data.displayName}</p>
          <p className="text-center text-xs text-slate-400">{data.organization?.name ?? "FRL Standardanzug"}</p>
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <EditorSection title="Körper & Gesicht">
          <Choice label="Körperbau" value={configuration.bodyShape} values={bodyShapes} onChange={(value) => patch("bodyShape", value)} />
          <Choice label="Gesichtsform" value={configuration.faceShape} values={faceShapes} onChange={(value) => patch("faceShape", value)} />
          <Choice label="Hautton" value={configuration.skinTone} values={skinTones} onChange={(value) => patch("skinTone", value)} />
          <Choice label="Augenform" value={configuration.eyeShape} values={eyeShapes} onChange={(value) => patch("eyeShape", value)} />
          <Choice label="Augenfarbe" value={configuration.eyeColor} values={eyeColors} onChange={(value) => patch("eyeColor", value)} />
          <Choice label="Augenbrauen" value={configuration.eyebrowStyle} values={eyebrowStyles} onChange={(value) => patch("eyebrowStyle", value)} />
          <Choice label="Nase" value={configuration.noseStyle} values={noseStyles} onChange={(value) => patch("noseStyle", value)} />
          <Choice label="Mund" value={configuration.mouthStyle} values={mouthStyles} onChange={(value) => patch("mouthStyle", value)} />
        </EditorSection>
        <EditorSection title="Haare & Details">
          <Choice label="Frisur" value={configuration.hairStyle} values={hairStyles} onChange={(value) => patch("hairStyle", value)} />
          <Choice label="Haarfarbe" value={configuration.hairColor} values={hairColors} onChange={(value) => patch("hairColor", value)} />
          <Choice label="Bart" value={configuration.beardStyle} values={beardStyles} onChange={(value) => patch("beardStyle", value)} />
          <Choice label="Brille" value={configuration.eyewearStyle} values={eyewearStyles} onChange={(value) => patch("eyewearStyle", value)} />
          <Choice label="Gesichtsdetail" value={configuration.faceDetail} values={faceDetails} onChange={(value) => patch("faceDetail", value)} />
        </EditorSection>
        <EditorSection title="Rennanzug, Helm & Pose">
          <Choice label="Teamanzug" value={String(suitVariantId ?? "default")} values={["default", ...data.templates.map((item) => String(item.id))]} valueLabel={(value) => value === "default" ? "Teamfarben / FRL Standard" : data.templates.find((item) => String(item.id) === value)?.name ?? value} onChange={(value) => setSuitVariantId(value === "default" ? null : Number(value))} />
          <Choice label="Normale Pose" value={normalPose} values={normalPoses} onChange={setNormalPose} />
          <Choice label="Siegerpose" value={winnerPose} values={winnerPoses} onChange={setWinnerPose} />
          <Choice label="Helmform" value={configuration.helmet.style} values={helmetStyles} onChange={(value) => patch("helmet", { ...configuration.helmet, style: value })} />
          <Choice label="Helmmuster" value={configuration.helmet.pattern} values={helmetPatterns} onChange={(value) => patch("helmet", { ...configuration.helmet, pattern: value })} />
          <Choice label="Helmposition" value={configuration.helmet.mode} values={helmetModes} onChange={(value) => patch("helmet", { ...configuration.helmet, mode: value })} />
          <Choice label="Handschuhe" value={configuration.gloves} values={["TEAM", "BLACK", "WHITE"] as const} onChange={(value) => patch("gloves", value)} />
          <Choice label="Schuhe" value={configuration.shoes} values={["TEAM", "BLACK", "WHITE"] as const} onChange={(value) => patch("shoes", value)} />
          <Choice label="Helmfinish" value={configuration.helmet.finish} values={["MATTE", "GLOSS"] as const} onChange={(value) => patch("helmet", { ...configuration.helmet, finish: value })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => <ColorField key={key} label={key === "primaryColor" ? "Helm Hauptfarbe" : key === "secondaryColor" ? "Helm Zweitfarbe" : "Helm Akzent"} value={configuration.helmet[key]} onChange={(value) => patch("helmet", { ...configuration.helmet, [key]: value })} />)}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([['showNumber', 'Startnummer'], ['showInitials', 'Initialen'], ['showFlag', 'Flagge']] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-300"><input type="checkbox" checked={configuration.helmet[key]} onChange={(event) => patch("helmet", { ...configuration.helmet, [key]: event.target.checked })} className="size-5" />{label}</label>)}
          </div>
          <Choice label="Hintergrund" value={configuration.background} values={backgrounds} onChange={(value) => patch("background", value)} />
        </EditorSection>
        <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
          <button type="button" onClick={save} disabled={pending} className="wizard-primary-button min-h-11"><Save size={18} /> {pending ? "Speichert …" : "Charakter speichern"}</button>
          <button type="button" onClick={reset} disabled={pending} className="wizard-secondary-button min-h-11"><RotateCcw size={18} /> Standard wiederherstellen</button>
          {message ? <p role="status" className="text-sm text-slate-300 sm:ml-auto">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) { return <fieldset className="master-card min-w-0 space-y-4"><legend className="px-1 text-lg font-black text-white">{title}</legend>{children}</fieldset>; }

function Choice<T extends string>({ label, value, values, onChange, valueLabel }: { label: string; value: T; values: readonly T[]; onChange: (value: T) => void; valueLabel?: (value: T) => string }) {
  const id = `character-${label.toLocaleLowerCase("de-DE").replaceAll(/[^a-z0-9]+/g, "-")}`;
  return <CharacterSelect id={id} label={label} value={value} options={values.map((item) => ({ value: item, label: valueLabel?.(item) ?? labels[item] ?? item.replaceAll("_", " ") }))} onChange={(next) => onChange(next as T)} />;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">{label}</span><span className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="size-8 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-xs text-slate-300">{value}</span></span></label>; }
