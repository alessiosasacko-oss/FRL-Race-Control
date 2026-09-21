"use client";

import { useMemo, useState } from "react";
import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";
import DiscordChannelSelect from "@/components/automation/DiscordChannelSelect";
import FormMessage from "@/components/ui/FormMessage";
import { FinanceTransactionType } from "@/domain";
import {
  createManualFinanceTransactionAction,
  publishFinanceDiscordAction,
  reconcileRaceFinanceAction,
  reconcileSeasonFinanceAction,
  saveFinancePublishSettingAction,
  saveFinanceRulesAction,
  setStartBalanceAction,
} from "@/lib/finance/actions";
import { initialFinanceActionState, type RaceFinancePreview, type SeasonFinancePreview } from "@/lib/finance/types";
import type { DiscordChannelOption } from "@/lib/discord/channel-matrix";
import { Banknote, Bot, Calculator, Save, Scale, Trophy } from "lucide-react";
import Link from "next/link";

type MoneyRules = {
  defaultStartBalanceEuro: string;
  participationFeeBps: number;
  superLicensePerPointEuro: string;
  poleRewardEuro: string;
  fastestLapRewardEuro: string;
  dnfFeeEuro: string;
  dsqFeeEuro: string;
  pitRetirementFeeEuro: string;
  frontWingDamageFeeEuro: string;
  underfloorDamageFeeEuro: string;
  sidepodDamageFeeEuro: string;
  rearWingDamageFeeEuro: string;
  positionRewards: string[];
  penaltyPointThresholds: string[];
  teamChampionshipRewards: string[];
};

type Props = {
  context: { leagueId: number; seasonId: number; leagueCode: string; seasonName: string };
  teams: Array<{ id: number; name: string }>;
  races: Array<{ id: number; name: string; round: number }>;
  drivers: Array<{ id: number; name: string }>;
  rules: MoneyRules;
  ruleVersion: number;
  racePreview: RaceFinancePreview | null;
  seasonPreview: SeasonFinancePreview | null;
  discord: {
    guild: { id: number; guildName: string; roles: Array<{ id: string; name: string }> } | null;
    channels: DiscordChannelOption[];
    channelMessage: string;
    setting: { enabled: boolean; autoReconcile: boolean; autoPublish: boolean; channelId: string; pingRoleId: string | null; messageTemplate: string; showBalances: boolean; showDelta: boolean } | null;
    preview: { title: string; description: string; channelName: string | null; roleName: string | null } | null;
  };
};

const fieldClass = "form-control mt-2 min-h-11";

function EuroField({ name, label, value }: { name: string; label: string; value: string }) {
  return <label className="master-label">{label}<input name={name} type="number" step="1" defaultValue={value} required className={fieldClass} /></label>;
}

function PreviewRows({ preview }: { preview: RaceFinancePreview | null }) {
  if (!preview) return <p className="text-sm text-slate-400">Für dieses Rennen ist noch keine Vorschau verfügbar.</p>;
  return <div className="space-y-3"><p className={`text-sm font-semibold ${preview.ready ? "text-emerald-300" : "text-amber-300"}`}>{preview.message}</p>{preview.teamTotals.map((team) => <div key={team.teamId} className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><div className="flex items-center justify-between gap-3"><span className="font-bold text-white">{team.teamName}</span><span className={`font-black ${BigInt(team.netEuro) >= BigInt(0) ? "text-emerald-300" : "text-rose-300"}`}>{BigInt(team.netEuro) > BigInt(0) ? "+" : ""}{new Intl.NumberFormat("de-DE").format(BigInt(team.netEuro))} €</span></div><p className="mt-1 text-xs text-slate-500">Opening {new Intl.NumberFormat("de-DE").format(BigInt(team.openingBalanceEuro))} € · Einnahmen {new Intl.NumberFormat("de-DE").format(BigInt(team.incomeEuro))} € · Ausgaben {new Intl.NumberFormat("de-DE").format(BigInt(team.expensesEuro))} €</p></div>)}</div>;
}

export default function FinanceAdminForms({ context, teams, races, drivers, rules, ruleVersion, racePreview, seasonPreview, discord }: Props) {
  const [startState, startAction, startPending] = useActionState(setStartBalanceAction, initialFinanceActionState);
  const [manualState, manualAction, manualPending] = useActionState(createManualFinanceTransactionAction, initialFinanceActionState);
  const [ruleState, ruleAction, rulePending] = useActionState(saveFinanceRulesAction, initialFinanceActionState);
  const [raceState, raceAction, racePending] = useActionState(reconcileRaceFinanceAction, initialFinanceActionState);
  const [seasonState, seasonAction, seasonPending] = useActionState(reconcileSeasonFinanceAction, initialFinanceActionState);
  const [discordState, discordAction, discordPending] = useActionState(saveFinancePublishSettingAction, initialFinanceActionState);
  const [publishState, publishAction, publishPending] = useActionState(publishFinanceDiscordAction, initialFinanceActionState);
  const initialChannelId = discord.setting?.channelId ?? "";
  const [channelId, setChannelId] = useState<string | null>(initialChannelId || null);
  const selectedRaceId = racePreview?.race.id ?? races[0]?.id ?? null;
  const selectedChannel = useMemo(() => discord.channels.find((channel) => channel.id === channelId), [channelId, discord.channels]);
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <section className="master-card min-w-0"><div className="flex items-start gap-3"><Banknote className="mt-1 text-emerald-400" /><div><h2 className="text-lg font-bold text-white">Teamkonto buchen</h2><p className="mt-1 text-sm text-slate-400">Keine Balance wird überschrieben; jede Änderung erzeugt einen Ledger-Eintrag.</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <form action={startAction} className="space-y-4 rounded-2xl border border-slate-800 p-4"><input type="hidden" name="leagueId" value={context.leagueId} /><input type="hidden" name="seasonId" value={context.seasonId} /><h3 className="font-semibold text-white">Startkontostand</h3><label className="master-label">Team<select name="teamId" required className={fieldClass}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><EuroField name="amountEuro" label="Ziel-Startwert in €" value="100000000" /><label className="master-label">Begründung<input name="description" required defaultValue="Startkontostand administrativ angepasst" className={fieldClass} /></label><FormMessage state={startState} /><button disabled={startPending || teams.length === 0} className="wizard-primary-button min-h-11 w-full"><Save size={17} />Startwert anpassen</button></form>
        <form action={manualAction} className="space-y-4 rounded-2xl border border-slate-800 p-4"><input type="hidden" name="leagueId" value={context.leagueId} /><input type="hidden" name="seasonId" value={context.seasonId} /><h3 className="font-semibold text-white">Manuelle Buchung</h3><label className="master-label">Team<select name="teamId" required className={fieldClass}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label className="master-label">Typ<select name="type" className={fieldClass}><option value={FinanceTransactionType.ManualAdjustment}>Manuelle Anpassung (+/−)</option><option value={FinanceTransactionType.RuleViolationFine}>Regelverstoß (Ausgabe)</option><option value={FinanceTransactionType.DriverTransfer}>Fahrertransfer (Ausgabe)</option></select></label><EuroField name="amountEuro" label="Betrag in € (+ oder −)" value="0" /><label className="master-label">Fahrer (optional)<select name="driverId" className={fieldClass}><option value="">Kein Fahrerbezug</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label><label className="master-label">Rennen (optional)<select name="raceId" className={fieldClass}><option value="">Kein Rennbezug</option>{races.map((race) => <option key={race.id} value={race.id}>R{race.round} · {race.name}</option>)}</select></label><label className="master-label">Grund<textarea name="description" required rows={3} className={fieldClass} /></label><FormMessage state={manualState} /><button disabled={manualPending || teams.length === 0} className="wizard-primary-button min-h-11 w-full"><Save size={17} />Finanzbuchung erstellen</button></form>
      </div></section>

      <section className="master-card min-w-0"><div className="flex items-start gap-3"><Calculator className="mt-1 text-blue-400" /><div><h2 className="text-lg font-bold text-white">Rennabrechnung</h2><p className="mt-1 text-sm text-slate-400">Vorschau aus final veröffentlichtem Qualifying und Rennen · Regelversion {racePreview?.ruleSet.version ?? ruleVersion}.</p></div></div><div className="mt-5"><PreviewRows preview={racePreview} /></div>{selectedRaceId ? <form action={raceAction} className="mt-5 space-y-3"><input type="hidden" name="raceId" value={selectedRaceId} /><input type="hidden" name="leagueId" value={context.leagueId} /><label className="flex min-h-11 items-center gap-3 text-sm text-slate-300"><input type="checkbox" name="useCurrentRules" className="size-5 accent-blue-500" />Bewusst mit aktueller Regelversion neu berechnen</label><FormMessage state={raceState} /><button disabled={racePending || !racePreview?.ready} className="wizard-primary-button min-h-11 w-full"><Scale size={17} />{racePreview?.settlement ? "Neu abgleichen" : "Finanzen finalisieren"}</button></form> : null}</section>

      <details className="master-card min-w-0 xl:col-span-2"><summary className="flex min-h-11 cursor-pointer items-center gap-3 font-bold text-white"><Scale className="text-violet-400" />Regelwerk · Version {ruleVersion || "Default"}</summary><form action={ruleAction} className="mt-5 grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-2 xl:grid-cols-4"><input type="hidden" name="leagueId" value={context.leagueId} /><input type="hidden" name="seasonId" value={context.seasonId} /><EuroField name="defaultStartBalanceEuro" label="Default Startkonto €" value={rules.defaultStartBalanceEuro} /><label className="master-label">Teilnahmegebühr Basispunkte<input name="participationFeeBps" type="number" min="0" max="10000" defaultValue={rules.participationFeeBps} required className={fieldClass} /><span className="mt-1 block normal-case text-slate-500">150 = 1,5 %</span></label><EuroField name="superLicensePerPointEuro" label="Superlizenz €/Punkt" value={rules.superLicensePerPointEuro} /><EuroField name="poleRewardEuro" label="Pole-Prämie €" value={rules.poleRewardEuro} /><EuroField name="fastestLapRewardEuro" label="Fastest-Lap-Prämie €" value={rules.fastestLapRewardEuro} /><EuroField name="dnfFeeEuro" label="DNF-Gebühr €" value={rules.dnfFeeEuro} /><EuroField name="dsqFeeEuro" label="DSQ-Gebühr €" value={rules.dsqFeeEuro} /><EuroField name="pitRetirementFeeEuro" label="Box-Aufgabe €" value={rules.pitRetirementFeeEuro} /><EuroField name="frontWingDamageFeeEuro" label="Frontflügel €" value={rules.frontWingDamageFeeEuro} /><EuroField name="underfloorDamageFeeEuro" label="Unterboden €" value={rules.underfloorDamageFeeEuro} /><EuroField name="sidepodDamageFeeEuro" label="Seitenkasten €" value={rules.sidepodDamageFeeEuro} /><EuroField name="rearWingDamageFeeEuro" label="Heckflügel €" value={rules.rearWingDamageFeeEuro} /><EuroField name="penaltyPoint8Euro" label="8-PP-Bußgeld €" value={rules.penaltyPointThresholds[0] ?? "1000000"} /><EuroField name="penaltyPoint20Euro" label="20-PP-Bußgeld €" value={rules.penaltyPointThresholds[1] ?? "10000000"} /><fieldset className="min-w-0 rounded-2xl border border-slate-800 p-4 md:col-span-2"><legend className="px-2 text-sm font-bold text-white">Rennplatzierungen P1–P12</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rules.positionRewards.map((value, index) => <EuroField key={index} name="positionRewards" label={`P${index + 1} €`} value={value} />)}</div></fieldset><fieldset className="min-w-0 rounded-2xl border border-slate-800 p-4 md:col-span-2"><legend className="px-2 text-sm font-bold text-white">Team-WM P1–P11</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rules.teamChampionshipRewards.map((value, index) => <EuroField key={index} name="teamChampionshipRewards" label={`P${index + 1} €`} value={value} />)}</div></fieldset><div className="space-y-3 md:col-span-2 xl:col-span-4"><FormMessage state={ruleState} /><button disabled={rulePending} className="wizard-primary-button min-h-11 w-full"><Save size={17} />Neue Regelversion aktivieren</button></div></form></details>

      <section className="master-card min-w-0"><div className="flex items-start gap-3"><Trophy className="mt-1 text-amber-400" /><div><h2 className="text-lg font-bold text-white">Team-WM-Endauszahlung</h2><p className="mt-1 text-sm text-slate-400">Bewusster Abschlussmechanismus; normale Tabellen-Neuberechnungen buchen nichts.</p></div></div><p className={`mt-5 text-sm font-semibold ${seasonPreview?.ready ? "text-emerald-300" : "text-amber-300"}`}>{seasonPreview?.message ?? "Noch keine Championship verfügbar."}</p><form action={seasonAction} className="mt-5 space-y-3"><input type="hidden" name="leagueId" value={context.leagueId} /><input type="hidden" name="seasonId" value={context.seasonId} /><label className="flex min-h-11 items-center gap-3 text-sm text-slate-300"><input type="checkbox" name="useCurrentRules" className="size-5 accent-blue-500" />Bei Korrektur aktuelle Regeln verwenden</label><FormMessage state={seasonState} /><button disabled={seasonPending || !seasonPreview?.ready} className="wizard-primary-button min-h-11 w-full"><Trophy size={17} />Finanzauszahlung durchführen</button></form></section>

      <section id="discord" className="master-card min-w-0"><div className="flex items-start gap-3"><Bot className="mt-1 text-indigo-400" /><div><h2 className="text-lg font-bold text-white">Discord Finance Publishing</h2><p className="mt-1 text-sm text-slate-400">Pro Liga, mit Outbox, Revision-Dedupe und sicherem Rollen-Ping.</p></div></div>{discord.guild ? <><form action={discordAction} className="mt-5 space-y-4"><input type="hidden" name="leagueId" value={context.leagueId} /><input type="hidden" name="guildSettingsId" value={discord.guild.id} /><input type="hidden" name="channelId" value={channelId ?? ""} /><DiscordChannelSelect label="Discord-Kanal" description={discord.channelMessage} channels={discord.channels} value={channelId} onChange={setChannelId} /><label className="master-label">Rollen-Ping<select name="pingRoleId" defaultValue={discord.setting?.pingRoleId ?? ""} className={fieldClass}><option value="">Kein Ping</option>{discord.guild.roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}</select></label><label className="master-label">Nachrichtenvorlage<textarea name="messageTemplate" rows={3} defaultValue={discord.setting?.messageTemplate ?? "Die aktuellen {league}-Teamfinanzen nach {race} · Runde {round} sind verfügbar."} className={fieldClass} /></label><div className="grid gap-2 sm:grid-cols-2">{[["enabled", "Publishing aktiv", discord.setting?.enabled ?? true], ["autoReconcile", "Auto-Abgleich nach Publish", discord.setting?.autoReconcile ?? false], ["autoPublish", "Automatisch veröffentlichen", discord.setting?.autoPublish ?? false], ["showBalances", "Kontostände zeigen", discord.setting?.showBalances ?? true], ["showDelta", "Renn-Delta zeigen", discord.setting?.showDelta ?? true]].map(([name, label, checked]) => <label key={String(name)} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-800 px-3 text-sm text-slate-300"><input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} className="size-5 accent-blue-500" />{String(label)}</label>)}</div>{discord.preview ? <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 text-sm"><p className="text-xs font-black uppercase tracking-wider text-indigo-300">Vorschau · #{discord.preview.channelName ?? selectedChannel?.name ?? "Kanal"}{discord.preview.roleName ? ` · @${discord.preview.roleName}` : " · ohne Ping"}</p><h3 className="mt-3 font-black text-white">{discord.preview.title}</h3><p className="mt-2 whitespace-pre-line text-slate-300">{discord.preview.description}</p></div> : selectedChannel ? <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 text-sm"><p className="font-bold text-indigo-200">Konfiguration · #{selectedChannel.name}</p><p className="mt-2 text-slate-300">Speichere die Konfiguration und aktualisiere die Vorschau, um das vollständige Finance-Embed zu sehen.</p></div> : null}<div className="grid gap-2 sm:grid-cols-2"><Link href={`/admin/finance?leagueId=${context.leagueId}&seasonId=${context.seasonId}${selectedRaceId ? `&raceId=${selectedRaceId}` : ""}#discord`} className="grid min-h-11 place-items-center rounded-xl border border-indigo-500/40 px-4 font-bold text-indigo-200 hover:bg-indigo-500/10">Vorschau aktualisieren</Link><button disabled={discordPending || !channelId} className="wizard-primary-button min-h-11 w-full"><Save size={17} />Publishing speichern</button></div><FormMessage state={discordState} /></form>{selectedRaceId ? <form action={publishAction} className="mt-3"><input type="hidden" name="raceId" value={selectedRaceId} /><input type="hidden" name="leagueId" value={context.leagueId} /><FormMessage state={publishState} /><button disabled={publishPending || !racePreview?.settlement} className="mt-3 min-h-11 w-full rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 font-bold text-indigo-200 hover:bg-indigo-500/20">Jetzt veröffentlichen</button></form> : null}</> : <p className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">Zuerst einen aktiven Discord-Server in der Automation konfigurieren.</p>}</section>
    </div>
  );
}
