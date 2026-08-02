"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, Pencil, Plus, Save } from "lucide-react";
import DriverCharacter from "./DriverCharacter";
import CharacterSelect from "./CharacterSelect";
import { archiveTeamSuitTemplateAction, saveTeamSuitTemplateAction } from "@/lib/characters/actions";
import { defaultDriverCharacter, neutralFrlSuit, parseSuitConfiguration, suitPatterns, type TeamSuitConfiguration } from "@/lib/characters/schema";

type Organization = { id: number; name: string; color: string; secondaryColor: string | null; contrastColor: string | null; suitTemplates: Array<{ id: number; organizationId: number; name: string; configuration: unknown; active: boolean; archivedAt: Date | null; displayOrder: number }> };

export default function TeamSuitAdmin({ organizations }: { organizations: Organization[] }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? 0);
  const organization = organizations.find((item) => item.id === organizationId) ?? organizations[0];
  const [name, setName] = useState("Standard-Rennanzug");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [configuration, setConfiguration] = useState<TeamSuitConfiguration>(() => ({ ...neutralFrlSuit, primaryColor: organization?.color ?? neutralFrlSuit.primaryColor, secondaryColor: organization?.secondaryColor ?? neutralFrlSuit.secondaryColor, accentColor: organization?.contrastColor ?? neutralFrlSuit.accentColor }));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const templates = useMemo(() => organization?.suitTemplates ?? [], [organization]);

  function selectOrganization(id: number) {
    const next = organizations.find((item) => item.id === id);
    setOrganizationId(id);
    setEditingId(null);
    setConfiguration({ ...neutralFrlSuit, primaryColor: next?.color ?? neutralFrlSuit.primaryColor, secondaryColor: next?.secondaryColor ?? neutralFrlSuit.secondaryColor, accentColor: next?.contrastColor ?? neutralFrlSuit.accentColor });
  }

  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(18rem,.75fr)_minmax(0,1.25fr)]">
    <aside className="master-card lg:sticky lg:top-24 lg:self-start"><div className="flex min-h-[23rem] items-end justify-center overflow-hidden rounded-2xl bg-slate-950"><DriverCharacter configuration={defaultDriverCharacter} teamSuit={configuration} pose="ARMS_CROSSED" variant="fullBody" driverNumber={1} alt="Vorschau des Rennanzugs" className="h-[22rem] max-w-full" showBackground /></div><p className="mt-3 text-center text-sm font-bold text-white">Live-Vorschau</p></aside>
    <div className="space-y-5">
      {organizations.length === 0 ? <div className="master-card text-sm text-slate-300">Noch keine Teamorganisation vorhanden. Lege zuerst ein Team an.</div> : <>
        <section className="master-card space-y-4">
          <h2 className="text-lg font-black text-white">Rennanzug anlegen</h2>
          <CharacterSelect id="suit-organization" label="Teamorganisation" value={String(organizationId)} options={organizations.map((item) => ({ value: String(item.id), label: item.name }))} onChange={(value) => selectOrganization(Number(value))} />
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-300">Name</span><input value={name} onChange={(event) => setName(event.target.value)} className="form-control min-h-11 w-full" maxLength={120} /></label>
          <div className="grid gap-3 sm:grid-cols-3">{(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => <label key={key}><span className="mb-2 block text-xs font-semibold text-slate-400">{key === "primaryColor" ? "Hauptfarbe" : key === "secondaryColor" ? "Zweitfarbe" : "Akzent"}</span><input type="color" value={configuration[key]} onChange={(event) => setConfiguration((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))} className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-slate-950 p-1" /></label>)}</div>
          <label><span className="mb-2 block text-xs font-semibold text-slate-400">Kragenfarbe</span><input type="color" value={configuration.collarColor} onChange={(event) => setConfiguration((current) => ({ ...current, collarColor: event.target.value.toUpperCase() }))} className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-slate-950 p-1" /></label>
          <CharacterSelect id="suit-pattern" label="Muster" value={configuration.pattern} options={suitPatterns.map((pattern) => ({ value: pattern, label: pattern.replaceAll("_", " ") }))} onChange={(value) => setConfiguration((current) => ({ ...current, pattern: value as TeamSuitConfiguration["pattern"] }))} />
          <CharacterSelect id="suit-sleeves" label="Ärmelgestaltung" value={configuration.sleeveStyle} options={[{ value: "SOLID", label: "Einfarbig" }, { value: "CONTRAST", label: "Kontrast" }, { value: "STRIPED", label: "Gestreift" }]} onChange={(value) => setConfiguration((current) => ({ ...current, sleeveStyle: value as TeamSuitConfiguration["sleeveStyle"] }))} />
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-300"><input type="checkbox" checked={configuration.sideStripes} onChange={(event) => setConfiguration((current) => ({ ...current, sideStripes: event.target.checked }))} className="size-5" />Seitenstreifen</label>
          <button type="button" disabled={pending || !organization} onClick={() => startTransition(async () => setMessage((await saveTeamSuitTemplateAction({ id: editingId ?? undefined, organizationId, name, configuration, active: true, displayOrder: editingId ? (templates.find((template) => template.id === editingId)?.displayOrder ?? 0) : templates.length })).message))} className="wizard-primary-button min-h-11"><Save size={18} /> {editingId ? "Änderungen speichern" : "Vorlage speichern"}</button>
          {message ? <p role="status" className="text-sm text-slate-300">{message}</p> : null}
        </section>
        <section className="space-y-3"><div className="flex items-center gap-2"><Plus size={18} className="text-blue-300" /><h2 className="text-lg font-black text-white">Vorhandene Varianten</h2></div>{templates.length === 0 ? <div className="master-card text-sm text-slate-400">Für dieses Team existiert noch keine eigene Vorlage. Es werden automatisch die Teamfarben verwendet.</div> : templates.map((template) => { const suit = parseSuitConfiguration(template.configuration); return <article key={template.id} className="master-card flex flex-col gap-4 sm:flex-row sm:items-center"><DriverCharacter configuration={defaultDriverCharacter} teamSuit={suit} variant="tableThumbnail" alt={`Rennanzug ${template.name}`} className="size-20 shrink-0" showShadow={false} /><div className="min-w-0 flex-1"><h3 className="font-bold text-white">{template.name}</h3><p className="text-xs text-slate-400">{template.active ? "Aktiv" : "Archiviert"}</p></div>{template.active ? <div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={pending} onClick={() => { setEditingId(template.id); setName(template.name); setConfiguration(suit); }} className="wizard-secondary-button min-h-11"><Pencil size={17} /> Bearbeiten</button><button type="button" disabled={pending} onClick={() => startTransition(async () => setMessage((await archiveTeamSuitTemplateAction(template.id)).message))} className="wizard-secondary-button min-h-11"><Archive size={17} /> Archivieren</button></div> : null}</article>; })}</section>
      </>}
    </div>
  </div>;
}
