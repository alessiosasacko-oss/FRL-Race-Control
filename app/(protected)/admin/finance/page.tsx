import { Landmark, SlidersHorizontal, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import FinanceAdminForms from "@/components/finance/FinanceAdminForms";
import FinanceLedger from "@/components/finance/FinanceLedger";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import { financeTransactionTypeLabels, FinanceTransactionType } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { persistedRules } from "@/lib/finance/ledger";
import { getFinanceAdminData, parseFinanceListQuery } from "@/lib/finance/queries";
import { DEFAULT_FINANCE_RULES } from "@/lib/finance/rules";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function money(value: string): string {
  return `${new Intl.NumberFormat("de-DE").format(BigInt(value))} €`;
}

export default async function FinanceAdminPage({ searchParams }: Props) {
  await requirePermission(Permission.ManageFinance);
  const raw = await searchParams;
  const query = parseFinanceListQuery(raw);
  const data = await getFinanceAdminData(query);
  const rules = data.ruleSet ? persistedRules(data.ruleSet) : DEFAULT_FINANCE_RULES;
  const params = new URLSearchParams();
  if (data.selectedLeague) params.set("leagueId", String(data.selectedLeague.id));
  if (data.selectedSeason) params.set("seasonId", String(data.selectedSeason.id));
  if (query.organizationId) params.set("organizationId", String(query.organizationId));
  if (query.raceId) params.set("raceId", String(query.raceId));
  if (query.driverId) params.set("driverId", String(query.driverId));
  if (query.type) params.set("type", query.type);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `/admin/finance?${next}`;
  };
  const serialRules = {
    defaultStartBalanceEuro: rules.defaultStartBalanceEuro.toString(),
    participationFeeBps: rules.participationFeeBps,
    superLicensePerPointEuro: rules.superLicensePerPointEuro.toString(),
    poleRewardEuro: rules.poleRewardEuro.toString(),
    fastestLapRewardEuro: rules.fastestLapRewardEuro.toString(),
    dnfFeeEuro: rules.dnfFeeEuro.toString(),
    dsqFeeEuro: rules.dsqFeeEuro.toString(),
    pitRetirementFeeEuro: rules.pitRetirementFeeEuro.toString(),
    frontWingDamageFeeEuro: rules.frontWingDamageFeeEuro.toString(),
    underfloorDamageFeeEuro: rules.underfloorDamageFeeEuro.toString(),
    sidepodDamageFeeEuro: rules.sidepodDamageFeeEuro.toString(),
    rearWingDamageFeeEuro: rules.rearWingDamageFeeEuro.toString(),
    positionRewards: rules.positionRewards.map((rule) => rule.amountEuro.toString()),
    penaltyPointThresholds: rules.penaltyPointThresholds.map((rule) => rule.amountEuro.toString()),
    teamChampionshipRewards: rules.teamChampionshipRewards.map((rule) => rule.amountEuro.toString()),
  };

  return (
    <AppLayout>
      <div className="page-stack min-w-0">
        <PageHeader title="FRL Teamfinanzen" subtitle="Ein globales Konto je Teamorganisation; Liga und Saison filtern ausschließlich das Journal." eyebrow="Finance control" icon={Landmark} backHref="/admin" backLabel="Zurück zur Administration" />

        <details className="rounded-2xl border border-slate-800 bg-[#101720]" open>
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-300"><SlidersHorizontal size={17} className="text-blue-400" />Buchungsjournal filtern</summary>
          <form action="/admin/finance" className="grid gap-3 border-t border-slate-800 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="master-label">Liga<select name="leagueId" defaultValue={data.selectedLeague?.id ?? ""} className="form-control mt-2 min-h-11">{data.leagues.map((league) => <option key={league.id} value={league.id}>FRL {league.code}</option>)}</select></label>
            <label className="master-label">Saison<select name="seasonId" defaultValue={data.selectedSeason?.id ?? ""} className="form-control mt-2 min-h-11">{data.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
            <label className="master-label">Team<select name="organizationId" defaultValue={query.organizationId ?? ""} className="form-control mt-2 min-h-11"><option value="">Alle Teams</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="master-label">Rennen<select name="raceId" defaultValue={query.raceId ?? ""} className="form-control mt-2 min-h-11"><option value="">Alle Rennen</option>{data.races.map((race) => <option key={race.id} value={race.id}>R{race.round} · {race.name}</option>)}</select></label>
            <label className="master-label">Fahrer<select name="driverId" defaultValue={query.driverId ?? ""} className="form-control mt-2 min-h-11"><option value="">Alle Fahrer</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
            <label className="master-label">Buchungstyp<select name="type" defaultValue={query.type ?? ""} className="form-control mt-2 min-h-11"><option value="">Alle Typen</option>{Object.values(FinanceTransactionType).map((type) => <option key={type} value={type}>{financeTransactionTypeLabels[type]}</option>)}</select></label>
            <button className="wizard-primary-button min-h-11 self-end sm:col-span-2 xl:col-span-1">Filter anwenden</button>
          </form>
        </details>

        <section aria-label="Globale Teamkonten" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.accounts.map((account) => {
            const negative = BigInt(account.balanceEuro) < BigInt(0);
            return (
              <article key={account.id} className={`min-w-0 overflow-hidden rounded-2xl border bg-[#101720] p-4 ${negative ? "border-rose-500/40" : "border-slate-800"}`}>
                <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl font-black text-white" style={{ backgroundColor: account.color }}>{account.shortName.slice(0, 3)}</span><div className="min-w-0"><h2 className="truncate font-bold text-white">{account.teamName}</h2><p className="text-xs text-slate-500">Globales FRL-Teamkonto</p></div></div>
                <p className={`mt-5 break-all text-2xl font-black tabular-nums ${negative ? "text-rose-300" : "text-white"}`}>{money(account.balanceEuro)}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300"><TrendingUp size={14} className="mb-1" />{money(account.totalIncomeEuro)}</span><span className="rounded-lg bg-rose-500/10 p-2 text-rose-300"><TrendingDown size={14} className="mb-1" />{money(account.totalExpensesEuro)}</span></div>
              </article>
            );
          })}
          {data.accounts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400 sm:col-span-2 xl:col-span-4">Noch keine globalen Teamkonten. Beim ersten Startwert oder der ersten Abrechnung werden sie angelegt.</div> : null}
        </section>

        {data.selectedLeague && data.selectedSeason ? (
          <>
            <FinanceAdminForms
              context={{ leagueId: data.selectedLeague.id, seasonId: data.selectedSeason.id, leagueCode: data.selectedLeague.code, seasonName: data.selectedSeason.name }}
              teams={data.teams}
              races={data.races}
              drivers={data.drivers}
              rules={serialRules}
              ruleVersion={data.ruleSet?.version ?? 0}
              racePreview={data.racePreview}
              seasonPreview={data.seasonPreview}
              discord={{
                guild: data.guild ? { id: data.guild.id, guildName: data.guild.guildName, roles: data.guild.roleMappings.map((role) => ({ id: role.discordRoleId, name: role.discordRoleName ?? role.role })) } : null,
                channels: data.channelState.catalog?.channels ?? [],
                channelMessage: data.channelState.message,
                setting: data.publishSetting ? { enabled: data.publishSetting.enabled, autoReconcile: data.publishSetting.autoReconcile, autoPublish: data.publishSetting.autoPublish, channelId: data.publishSetting.channelId, pingRoleId: data.publishSetting.pingRoleId, messageTemplate: data.publishSetting.messageTemplate, showBalances: data.publishSetting.showBalances, showDelta: data.publishSetting.showDelta } : null,
                preview: data.discordPreview ? { title: data.discordPreview.title, description: data.discordPreview.description, channelName: data.discordPreview.channelName, roleName: data.discordPreview.roleName } : null,
              }}
            />
            <section className="master-card min-w-0"><div className="mb-5 flex items-center gap-3"><WalletCards className="text-blue-400" /><div><h2 className="text-lg font-bold text-white">Buchungsjournal</h2><p className="text-sm text-slate-400">{data.pagination.total} Buchungen · Kontostände darüber bleiben global</p></div></div><FinanceLedger transactions={data.transactions} page={data.pagination.page} pages={data.pagination.pages} pageHref={pageHref} /></section>
          </>
        ) : <div className="master-card text-slate-400">Noch keine Liga oder Saison vorhanden.</div>}
      </div>
    </AppLayout>
  );
}
