"use client";

import { AlertTriangle, CheckCircle2, FlaskConical, RefreshCw, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";
import FormMessage from "@/components/ui/FormMessage";
import {
  reloadDiscordChannelsAction,
  saveLeagueDiscordChannelMatrixAction,
  testLeagueDiscordChannelAction,
} from "@/lib/automation/actions";
import { initialAutomationActionState } from "@/lib/automation/types";
import {
  APP_FORM_CLEAN_EVENT,
  APP_FORM_DIRTY_EVENT,
} from "@/lib/live/data-events";
import {
  suggestLeagueChannel,
  type DiscordChannelMatrixData,
  type DiscordChannelOption,
  type LeagueChannelMatrixRow,
} from "@/lib/discord/channel-matrix";
import DiscordChannelSelect from "./DiscordChannelSelect";

type Selection = {
  leagueId: number;
  resultChannelId: string | null;
  standingsChannelId: string | null;
};

function selectionsFromRows(rows: readonly LeagueChannelMatrixRow[]): Selection[] {
  return rows.map((row) => ({
    leagueId: row.leagueId,
    resultChannelId: row.resultChannelId,
    standingsChannelId: row.standingsChannelId,
  }));
}

function selectionKey(rows: readonly Selection[]): string {
  return JSON.stringify(rows);
}

function channelProblem(channelId: string | null, channels: readonly DiscordChannelOption[]): string | null {
  if (!channelId) return "Channel fehlt";
  const channel = channels.find((candidate) => candidate.id === channelId);
  if (!channel) return "Channel wurde auf Discord gelöscht";
  return channel.selectable ? null : channel.unavailableReason ?? "Channel ist ungeeignet";
}

export default function DiscordChannelMatrix({ data }: { data: DiscordChannelMatrixData }) {
  const [channels, setChannels] = useState(data.channelState.catalog?.channels ?? []);
  const [channelMessage, setChannelMessage] = useState(data.channelState.message);
  const [channelLoadError, setChannelLoadError] = useState(data.channelState.status === "error");
  const initialSelections = useMemo(() => selectionsFromRows(data.rows), [data.rows]);
  const [selections, setSelections] = useState(initialSelections);
  const [savedSelections, setSavedSelections] = useState(initialSelections);
  const [normalizationConfirmed, setNormalizationConfirmed] = useState(false);
  const selectionsRef = useRef(selections);
  const [reloadPending, startReload] = useTransition();
  const [testPending, startTest] = useTransition();
  const [testMessages, setTestMessages] = useState<Record<string, { status: "success" | "error"; message: string }>>({});
  const [saveState, saveAction, savePending] = useActionState(
    saveLeagueDiscordChannelMatrixAction,
    initialAutomationActionState,
    undefined,
    ["automation"],
  );
  const dirty = selectionKey(selections) !== selectionKey(savedSelections);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    if (saveState.status === "success") {
      setSavedSelections(selectionsRef.current);
      setNormalizationConfirmed(true);
    }
  }, [saveState]);

  useEffect(() => {
    const event = dirty ? APP_FORM_DIRTY_EVENT : APP_FORM_CLEAN_EVENT;
    window.dispatchEvent(new CustomEvent(event));
    if (!dirty) return;
    const warn = (browserEvent: BeforeUnloadEvent) => browserEvent.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.dispatchEvent(new CustomEvent(APP_FORM_CLEAN_EVENT));
    };
  }, [dirty]);

  const selectionsByLeague = new Map(selections.map((selection) => [selection.leagueId, selection]));
  const configuredCount = data.rows.reduce((count, row) => {
    const selection = selectionsByLeague.get(row.leagueId)!;
    return count
      + ((normalizationConfirmed || (!row.resultInconsistent && row.resultPurposeCount === 3)) && !channelProblem(selection.resultChannelId, channels) ? 1 : 0)
      + ((normalizationConfirmed || (!row.standingsInconsistent && row.standingsPurposeCount === 2)) && !channelProblem(selection.standingsChannelId, channels) ? 1 : 0);
  }, 0);
  const totalCount = data.rows.length * 2;
  const normalizationRequired = !normalizationConfirmed && data.rows.some((row) =>
    (Boolean(row.resultChannelId) && row.resultPurposeCount !== 3) ||
    (Boolean(row.standingsChannelId) && row.standingsPurposeCount !== 2),
  );

  function updateSelection(leagueId: number, field: "resultChannelId" | "standingsChannelId", channelId: string | null) {
    setSelections((current) => current.map((selection) =>
      selection.leagueId === leagueId ? { ...selection, [field]: channelId } : selection,
    ));
  }

  function reloadChannels() {
    if (!data.guildSettingsId) return;
    startReload(async () => {
      const state = await reloadDiscordChannelsAction(data.guildSettingsId!);
      setChannelMessage(state.message);
      setChannelLoadError(state.status === "error");
      if (state.catalog) setChannels(state.catalog.channels);
    });
  }

  function testChannel(row: LeagueChannelMatrixRow, kind: "RESULT" | "STANDINGS") {
    const selection = selectionsByLeague.get(row.leagueId);
    const channelId = kind === "RESULT" ? selection?.resultChannelId : selection?.standingsChannelId;
    const key = `${row.leagueId}:${kind}`;
    if (!data.guildSettingsId || !channelId) {
      setTestMessages((current) => ({ ...current, [key]: { status: "error", message: "Bitte zuerst einen geeigneten Channel auswählen." } }));
      return;
    }
    startTest(async () => {
      const state = await testLeagueDiscordChannelAction({
        guildSettingsId: data.guildSettingsId,
        leagueId: row.leagueId,
        channelId,
        kind,
      });
      setTestMessages((current) => ({ ...current, [key]: { status: state.status === "success" ? "success" : "error", message: state.message } }));
    });
  }

  function rowContent(row: LeagueChannelMatrixRow): ReactNode[] {
    const selection = selectionsByLeague.get(row.leagueId)!;
    const resultProblem = row.resultInconsistent && !selection.resultChannelId
      ? "Uneinheitliche Ergebnis-Zuordnung"
      : channelProblem(selection.resultChannelId, channels) ?? (
          !normalizationConfirmed && selection.resultChannelId === row.resultChannelId && row.resultPurposeCount !== 3
            ? `${3 - row.resultPurposeCount} interne Zuordnung${3 - row.resultPurposeCount === 1 ? "" : "en"} fehlt`
            : null
        );
    const standingsProblem = row.standingsInconsistent && !selection.standingsChannelId
      ? "Uneinheitliche Tabellen-Zuordnung"
      : channelProblem(selection.standingsChannelId, channels) ?? (
          !normalizationConfirmed && selection.standingsChannelId === row.standingsChannelId && row.standingsPurposeCount !== 2
            ? `${2 - row.standingsPurposeCount} interne Zuordnung${2 - row.standingsPurposeCount === 1 ? "" : "en"} fehlt`
            : null
        );
    const suggestedResult = row.suggestedResultChannelId ?? suggestLeagueChannel(channels, row.leagueCode, "RESULT");
    const suggestedStandings = row.suggestedStandingsChannelId ?? suggestLeagueChannel(channels, row.leagueCode, "STANDINGS");
    return [
        <DiscordChannelSelect key="result" label="Ergebnis-Channel" channels={channels} value={selection.resultChannelId} onChange={(value) => updateSelection(row.leagueId, "resultChannelId", value)} suggestedChannelId={suggestedResult} disabled={!data.guildSettingsId || channelLoadError} />,
        <DiscordChannelSelect key="standings" label="Tabellen-Channel" channels={channels} value={selection.standingsChannelId} onChange={(value) => updateSelection(row.leagueId, "standingsChannelId", value)} suggestedChannelId={suggestedStandings} disabled={!data.guildSettingsId || channelLoadError} />,
        <div key="status" className="space-y-1 text-xs">
          <p className={`flex items-start gap-1.5 ${resultProblem ? "text-amber-300" : "text-emerald-300"}`}>{resultProblem ? <AlertTriangle className="mt-0.5 shrink-0" size={14} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={14} />}{resultProblem ?? "Ergebnisse verbunden"}</p>
          <p className={`flex items-start gap-1.5 ${standingsProblem ? "text-amber-300" : "text-emerald-300"}`}>{standingsProblem ? <AlertTriangle className="mt-0.5 shrink-0" size={14} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={14} />}{standingsProblem ?? "Tabellen verbunden"}</p>
        </div>,
        <div key="tests" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <button type="button" disabled={testPending || Boolean(resultProblem)} onClick={() => testChannel(row, "RESULT")} className="wizard-secondary-button min-h-11 w-full justify-center"><FlaskConical size={15} />Ergebnis testen</button>
          <button type="button" disabled={testPending || Boolean(standingsProblem)} onClick={() => testChannel(row, "STANDINGS")} className="wizard-secondary-button min-h-11 w-full justify-center"><FlaskConical size={15} />Tabellen testen</button>
          {["RESULT", "STANDINGS"].map((kind) => {
            const message = testMessages[`${row.leagueId}:${kind}`];
            return message ? <p key={kind} role="status" className={`text-xs ${message.status === "success" ? "text-emerald-300" : "text-red-300"}`}>{message.message}</p> : null;
          })}
        </div>,
    ];
  }

  return (
    <form action={saveAction} className="master-card min-w-0" data-dirty={dirty ? "true" : "false"}>
      <input type="hidden" name="guildSettingsId" value={data.guildSettingsId ?? ""} />
      <input type="hidden" name="rows" value={JSON.stringify(selections)} />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="eyebrow">Discord-Kanalzuordnung</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Liga-Matrix</h2>
          <p className="mt-2 text-sm text-slate-400">{configuredCount} von {totalCount} Channels vollständig konfiguriert{dirty ? " · Ungespeicherte Änderungen" : ""}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={reloadChannels} disabled={!data.guildSettingsId || reloadPending} className="wizard-secondary-button min-h-11 justify-center"><RefreshCw className={reloadPending ? "animate-spin" : ""} size={16} />Kanäle neu laden</button>
          <button type="button" onClick={() => setSelections(savedSelections)} disabled={!dirty || savePending} className="wizard-secondary-button min-h-11 justify-center"><RotateCcw size={16} />Änderungen verwerfen</button>
          <button type="submit" disabled={(!dirty && !normalizationRequired) || savePending || channelLoadError} className="wizard-primary-button min-h-11 justify-center"><Save size={16} />{savePending ? "Speichert …" : "Alle Zuordnungen speichern"}</button>
        </div>
      </div>
      <p role={channelLoadError ? "alert" : "status"} className={`mt-4 rounded-xl border p-3 text-sm ${channelLoadError ? "border-red-500/25 bg-red-500/10 text-red-200" : "border-slate-800 bg-slate-950/35 text-slate-400"}`}>{channelMessage}</p>
      <FormMessage state={saveState} />

      <div className="mt-5 space-y-4 lg:hidden">
        {data.rows.map((row) => (
          <article key={row.leagueId} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
            <div className="mb-4"><h3 className="text-xl font-black text-white">{row.leagueCode}</h3><p className="text-xs text-slate-500">{row.leagueName}</p></div>
            <div className="space-y-5">{rowContent(row)}</div>
          </article>
        ))}
      </div>

      <div className="mt-5 hidden lg:block">
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[1100px] table-fixed text-left">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="w-24 p-4">Liga</th><th className="p-4">Ergebnis-Channel</th><th className="p-4">Tabellen-Channel</th><th className="w-52 p-4">Status</th><th className="w-52 p-4">Test</th></tr></thead>
            <tbody>{data.rows.map((row) => <tr key={row.leagueId} className="border-t border-slate-800 align-top"><td className="p-4"><strong className="text-xl text-white">{row.leagueCode}</strong><span className="mt-1 block text-xs text-slate-500">{row.leagueName}</span></td>{rowContent(row).map((child, index) => <td key={index} className="p-4">{child}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
      {data.rows.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">Keine aktiven Ligen vorhanden.</p> : null}
    </form>
  );
}
