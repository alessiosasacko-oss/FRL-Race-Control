"use client";

import Image from "next/image";
import { Download, ImageIcon, RefreshCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ResultSession } from "@/domain";
import { graphicTemplates, isGraphicTemplate, templatesForSession, type GraphicTemplate } from "@/lib/graphics/templates/catalog";

type Props = { raceId: number; leagueId: number; resultSessionId: number | null; session: ResultSession; revision?: number };
export default function ResultGraphicPreview(props: Props) {
  return <GraphicStudio key={`${props.raceId}-${props.leagueId}-${props.resultSessionId}-${props.session}-${props.revision}`} {...props} />;
}

function GraphicStudio({ raceId, leagueId, resultSessionId, session }: Props) {
  const options = templatesForSession(session);
  const [type, setType] = useState<GraphicTemplate | undefined>(options[0]);
  const [preview, setPreview] = useState<{ url: string; width: number; height: number; type: GraphicTemplate } | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function renderPreview() {
    if (!type) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setPreview(null);
    setMessage("");
    try {
      const response = await fetch("/api/admin/results/graphics/preview", { method: "POST", signal: request.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ raceId, leagueId, resultSessionId, session, type }) });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(error?.message ?? "Die Grafik konnte nicht erzeugt werden.");
      }
      const blob = await response.blob();
      if (request.signal.aborted) return;
      setPreview({ url: URL.createObjectURL(blob), width: Number(response.headers.get("x-graphic-width")) || 1920, height: Number(response.headers.get("x-graphic-height")) || 1080, type });
    } catch (error: unknown) {
      if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : "Die Grafik konnte nicht erzeugt werden.");
    } finally { if (!request.signal.aborted) setPending(false); }
  }
  return (
    <section aria-label="FRL Graphics Studio" className="min-w-0 overflow-hidden rounded-2xl border border-pink-400/25 bg-slate-950/60">
      <div className="h-1 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-300" />
      <div className="space-y-5 p-4 sm:p-6">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Official FRL Media</p><h3 className="mt-2 text-2xl font-black tracking-tight text-white">Graphics Studio</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Präsentationsreife PNGs aus veröffentlichten Ergebnissen. Aktuelle Fahrer-Renderbilder und Teamlogos werden automatisch eingebunden.</p></div>
        {options.length ? <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="master-label min-w-0">Grafiktyp<select value={type} disabled={pending} onChange={(event) => { if (isGraphicTemplate(event.target.value)) { setType(event.target.value); setPreview(null); setMessage(""); } }} className="form-control mt-2 min-h-12 w-full">{options.map((key) => <option key={key} value={key}>{graphicTemplates[key].label}</option>)}</select></label>
          <button type="button" onClick={() => void renderPreview()} disabled={pending} className="wizard-secondary-button min-h-12 justify-center"><RefreshCcw size={17} />{pending ? "Grafik wird gerendert …" : "Grafik erzeugen"}</button>
          {preview ? <a href={preview.url} download={`frl-race-${raceId}-league-${leagueId}-${preview.type.toLowerCase()}.png`} className="wizard-primary-button min-h-12 justify-center"><Download size={17} />PNG herunterladen</a> : null}
        </div> : <p className="text-sm text-slate-400">Das Studio steht für Qualifying und Hauptrennen bereit.</p>}
        <p role="status" aria-live="polite" className="text-xs text-slate-400">{pending ? "Portraits werden geladen und das PNG wird erstellt." : preview ? `${preview.width} × ${preview.height} px · PNG · ${graphicTemplates[preview.type].label}` : "Die Grafik verwendet ausschließlich veröffentlichte Daten und versendet keine Nachricht."}</p>
      </div>
      {message ? <p role="alert" className="border-t border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{message}</p> : null}
      {preview ? <div className="border-t border-slate-800 bg-black p-2 sm:p-4"><Image src={preview.url} alt={`FRL ${graphicTemplates[preview.type].label}`} width={preview.width} height={preview.height} unoptimized className="h-auto w-full object-contain" /></div> : <div aria-hidden="true" className="grid min-h-40 place-items-center border-t border-slate-800 bg-[radial-gradient(ellipse_at_top,rgba(236,72,153,.12),transparent_70%)] text-slate-500"><ImageIcon size={34} /></div>}
    </section>
  );
}
