"use client";

import Image from "next/image";
import { Download, ImageIcon, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ResultSession } from "@/domain";

export default function ResultGraphicPreview({ raceId, leagueId, resultSessionId, session }: { raceId: number; leagueId: number; resultSessionId: number | null; session: ResultSession }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  async function renderPreview() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/results/graphics/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ raceId, leagueId, resultSessionId, session }) });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(error?.message ?? "Vorschau fehlgeschlagen.");
      }
      const next = URL.createObjectURL(await response.blob());
      setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return next; });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Vorschau fehlgeschlagen.");
    } finally { setPending(false); }
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/45">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="eyebrow">FRL Grafik-Renderer</p><p className="mt-1 text-sm text-slate-400">Die Vorschau nutzt den zuletzt gespeicherten Entwurf und veröffentlicht keine Daten.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={renderPreview} disabled={pending} className="wizard-secondary-button min-h-11 justify-center"><RefreshCcw size={17} />{previewUrl ? "Vorschau neu rendern" : "Grafikvorschau erzeugen"}</button>
          {previewUrl ? <a href={previewUrl} download={`frl-${session.toLowerCase()}-preview.png`} className="wizard-primary-button min-h-11 justify-center"><Download size={17} />PNG herunterladen</a> : null}
        </div>
      </div>
      {message ? <p role="alert" className="border-t border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{message}</p> : null}
      {previewUrl ? <div className="border-t border-slate-800 bg-black p-2 sm:p-4"><Image src={previewUrl} alt="FRL Ergebnisgrafik Vorschau mit Entwurf-Wasserzeichen" width={1920} height={1080} unoptimized className="h-auto w-full rounded-xl object-contain" /></div> : <div className="grid min-h-36 place-items-center border-t border-slate-800 text-slate-500"><ImageIcon size={34} /></div>}
    </section>
  );
}
