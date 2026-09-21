import AppLayout from "@/components/layout/AppLayout";
import FinanceLedger from "@/components/finance/FinanceLedger";
import PageHeader from "@/components/ui/PageHeader";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getAuthorizedTeamFinanceData } from "@/lib/finance/queries";
import { Landmark, TrendingDown, TrendingUp } from "lucide-react";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TeamFinancePage({ searchParams }: Props) {
  const user = await requirePermission(Permission.ViewFinance);
  const raw = await searchParams;
  const rawTeam = Array.isArray(raw.teamId) ? raw.teamId[0] : raw.teamId;
  const teamId = Number.isInteger(Number(rawTeam)) ? Number(rawTeam) : undefined;
  const data = await getAuthorizedTeamFinanceData(user, teamId);
  const account = data.selected;
  return <AppLayout><div className="page-stack min-w-0"><PageHeader title="Teamfinanzen" subtitle={data.canManageAll ? "Lesender Überblick über alle Teamkonten." : "Dein Teamkonto und das vollständige Buchungsjournal."} eyebrow="Finance" icon={Landmark} />
    {data.teams.length > 1 ? <form action="/finance" className="master-card grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><label className="master-label">Teamkonto<select name="teamId" defaultValue={account?.teamId ?? ""} className="form-control mt-2 min-h-11">{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name} · FRL {team.league.code} · {team.season.name}</option>)}</select></label><button className="wizard-primary-button min-h-11">Konto öffnen</button></form> : null}
    {account ? <><section className={`overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,rgba(37,99,235,.18),rgba(2,6,23,.85))] p-5 sm:p-7 ${BigInt(account.balanceEuro) < BigInt(0) ? "border-rose-500/50" : "border-blue-500/30"}`}><p className="text-xs font-black uppercase tracking-[.18em] text-blue-300">{account.teamName} · FRL {account.league.code}</p><p className={`mt-4 break-all text-3xl font-black tabular-nums sm:text-5xl ${BigInt(account.balanceEuro) < BigInt(0) ? "text-rose-300" : "text-white"}`}>{new Intl.NumberFormat("de-DE").format(BigInt(account.balanceEuro))} €</p><p className="mt-2 text-sm text-slate-400">Aktueller Kontostand · {account.season.name}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><TrendingUp className="text-emerald-300" /><p className="mt-2 text-xs uppercase tracking-wider text-emerald-200/70">Einnahmen</p><p className="mt-1 text-xl font-black text-emerald-300">{new Intl.NumberFormat("de-DE").format(BigInt(account.totalIncomeEuro))} €</p></div><div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4"><TrendingDown className="text-rose-300" /><p className="mt-2 text-xs uppercase tracking-wider text-rose-200/70">Ausgaben</p><p className="mt-1 text-xl font-black text-rose-300">{new Intl.NumberFormat("de-DE").format(BigInt(account.totalExpensesEuro))} €</p></div></div></section><section className="master-card min-w-0"><h2 className="mb-5 text-lg font-bold text-white">Buchungsjournal</h2><FinanceLedger transactions={data.transactions} /></section></> : <div className="master-card text-center text-slate-400">Für deinen Benutzer ist noch kein Teamkonto verfügbar.</div>}
  </div></AppLayout>;
}
