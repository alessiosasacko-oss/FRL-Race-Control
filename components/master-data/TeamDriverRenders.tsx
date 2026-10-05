"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { TeamOrganizationItem } from "@/lib/master-data/types";
import { DRIVER_IMAGE_MAX_BYTES } from "@/lib/storage/driver-image";
import { dispatchAppDataChanged } from "@/lib/live/data-events";

type Props = Pick<TeamOrganizationItem, "id" | "name" | "driverOneGraphicImageUrl" | "driverTwoGraphicImageUrl" | "currentSeasonId" | "leagues">;

export default function TeamDriverRenders({ team }: { team: Props }) {
  return <section className="mt-6 min-w-0 rounded-2xl border border-pink-400/20 bg-slate-950/40 p-4 sm:p-5" aria-labelledby={`team-renders-${team.id}`}>
    <h3 id={`team-renders-${team.id}`} className="text-lg font-black text-white">Graphics Studio Fahrerbilder</h3>
    <p className="mt-2 text-sm leading-6 text-slate-400">Zwei Renderbilder für {team.name}, gemeinsam für alle Ligen. Ordne darunter die Stammfahrer je Liga den Slots zu. Neue Zuordnungen gelten ab jetzt; alte Ergebnisse ohne eindeutigen Snapshot verwenden das Fahrerbild als Fallback.</p>
    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
      <RenderUpload key={`${team.id}-1`} organizationId={team.id} slot={1} initialUrl={team.driverOneGraphicImageUrl} />
      <RenderUpload key={`${team.id}-2`} organizationId={team.id} slot={2} initialUrl={team.driverTwoGraphicImageUrl} />
    </div>
    {team.currentSeasonId ? <div className="mt-5 space-y-3">{team.leagues.filter((league) => league.primaryDrivers.length > 0).map((league) => <SlotAssignment key={`${team.id}-${team.currentSeasonId}-${league.id}-${league.primaryDrivers.map((driver) => `${driver.id}:${driver.graphicSlot}`).join(",")}`} organizationId={team.id} seasonId={team.currentSeasonId!} league={league} />)}</div> : <p className="mt-4 text-sm text-slate-400">Slot-Zuordnung ist mit einer aktiven Saison verfügbar.</p>}
  </section>;
}

function RenderUpload({ organizationId, slot, initialUrl }: { organizationId: number; slot: 1 | 2; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const endpoint = `/api/admin/teams/${organizationId}/driver-renders/${slot}`;
  async function save(remove: boolean) {
    if (busy || (!remove && !file)) return;
    if (remove && !window.confirm(`Fahrer ${slot} Render wirklich entfernen?`)) return;
    if (!remove && file!.size > DRIVER_IMAGE_MAX_BYTES) { setMessage("Maximal 3 MB pro Bild."); return; }
    setBusy(true); setMessage("");
    try {
      const body = new FormData();
      if (file) body.set("image", file);
      const response = await fetch(endpoint, { method: remove ? "DELETE" : "POST", body: remove ? undefined : body });
      const payload = await response.json() as { imageUrl: string | null; message: string };
      if (!response.ok) throw new Error(payload.message);
      setUrl(payload.imageUrl); setMessage(payload.message); setFile(null);
      if (input.current) input.current.value = "";
      dispatchAppDataChanged(["teams", "results"]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Bild konnte nicht gespeichert werden."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0 rounded-xl border border-slate-800 p-4">
    <h4 className="font-bold text-white">Fahrer {slot} Render</h4>
    <div className="mt-3 flex h-44 items-center justify-center rounded-lg bg-slate-900">
      {url ? <Image src={url} alt={`Fahrer ${slot} Render`} width={140} height={176} unoptimized className="h-44 max-w-full object-contain" /> : <span className="text-sm text-slate-500">Noch kein Renderbild</span>}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-400">PNG, WebP oder JPEG · max. 3 MB · Transparenz bleibt erhalten.</p>
    <label className="master-label mt-3 block min-w-0">Fahrer {slot} Bild auswählen<input ref={input} type="file" accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setMessage(""); }} className="form-control mt-2 min-h-12 w-full min-w-0 max-w-full text-xs" /></label>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <button type="button" disabled={busy || !file} onClick={() => void save(false)} className="wizard-primary-button min-h-12 justify-center">{busy ? "Bitte warten …" : url ? "Bild ersetzen" : "Bild hochladen"}</button>
      {url ? <button type="button" disabled={busy} onClick={() => void save(true)} className="wizard-secondary-button min-h-12 justify-center text-red-200">Bild entfernen</button> : null}
    </div>
    <p role="status" aria-live="polite" className="mt-3 break-words text-sm text-slate-300">{message}</p>
  </div>;
}

function SlotAssignment({ organizationId, seasonId, league }: { organizationId: number; seasonId: number; league: Props["leagues"][number] }) {
  const [one, setOne] = useState(String(league.primaryDrivers.find((driver) => driver.graphicSlot === 1)?.id ?? ""));
  const [two, setTwo] = useState(String(league.primaryDrivers.find((driver) => driver.graphicSlot === 2)?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/teams/${organizationId}/graphic-slots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasonId, leagueId: league.id, driverOneId: one ? Number(one) : null, driverTwoId: two ? Number(two) : null }) });
      const payload = await response.json() as { message: string };
      if (!response.ok) throw new Error(payload.message);
      setMessage(payload.message); dispatchAppDataChanged(["teams", "drivers", "results"]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Zuordnung konnte nicht gespeichert werden."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0 rounded-xl border border-slate-800 p-4">
    <h4 className="font-bold text-white">{league.code} · Fahrer-Slots</h4>
    <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
      {[{ slot: 1, value: one, change: setOne }, { slot: 2, value: two, change: setTwo }].map(({ slot, value, change }) => <label key={slot} className="master-label min-w-0">Fahrer {slot}<select value={value} disabled={busy} onChange={(event) => { change(event.target.value); setMessage(""); }} className="form-control mt-2 min-h-12 w-full min-w-0"><option value="">Nicht zugeordnet · Fallback</option>{league.primaryDrivers.map((driver) => <option key={driver.id} value={driver.id}>#{driver.number} {driver.name}</option>)}</select></label>)}
      <button type="button" disabled={busy || Boolean(one && one === two)} onClick={() => void save()} className="wizard-secondary-button min-h-12 justify-center">{busy ? "Speichert …" : "Slots speichern"}</button>
    </div>
    {one && one === two ? <p role="alert" className="mt-2 text-sm text-red-300">Ein Fahrer kann nur einen Slot belegen.</p> : null}
    <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-300">{message}</p>
  </div>;
}
