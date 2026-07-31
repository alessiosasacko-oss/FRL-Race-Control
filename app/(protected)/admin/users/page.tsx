import Image from "next/image";
import Link from "next/link";
import { Eye, Filter, ShieldCheck, UserCog, Users } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { DriverLineupStatus, Role, roleLabels } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getUserAdminList,
  getUserAdminOptions,
  getUserDataQualityReport,
  parseUserListQuery,
} from "@/lib/users/queries";

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UsersAdminPage({ searchParams }: UsersPageProps) {
  await requirePermission(Permission.ManageUsers);
  const query = parseUserListQuery(await searchParams);
  const [users, options, quality] = await Promise.all([
    getUserAdminList(query),
    getUserAdminOptions(),
    getUserDataQualityReport(),
  ]);

  return (
    <AppLayout>
      <div className="page-stack page-accent-admin">
        <PageHeader
          title="Benutzer & Rollen"
          eyebrow="Identity & access"
          subtitle="Systemrollen, sportliche Zuordnung und effektive Berechtigungen sicher verwalten."
          icon={UserCog}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QualityMetric label="Benutzer" value={users.length} />
          <QualityMetric label="Ohne Fahrerprofil" value={quality.usersWithoutDriver} warning={quality.usersWithoutDriver > 0} />
          <QualityMetric label="Ohne Team" value={quality.driversWithoutTeam} warning={quality.driversWithoutTeam > 0} />
          <QualityMetric label="Manuell prüfen" value={quality.invalidCountryCodes.length + quality.overfilledPrimarySlots} warning={quality.invalidCountryCodes.length + quality.overfilledPrimarySlots > 0} />
        </section>

        <details className="surface-panel lg:hidden">
          <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-5 font-bold text-white">
            <Filter size={18} /> Filter öffnen
          </summary>
          <div className="border-t border-[var(--color-border)] p-4">
            <UserFilters query={query} options={options} />
          </div>
        </details>
        <div className="hidden lg:block">
          <UserFilters query={query} options={options} />
        </div>

        {users.length ? (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-[#101720] lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-4">Benutzer</th><th className="px-5 py-4">Fahrer</th><th className="px-5 py-4">Liga / Team</th><th className="px-5 py-4">Rollen</th><th className="px-5 py-4">Letzte Anmeldung</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aktion</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map((user) => <DesktopUserRow key={user.id} user={user} />)}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 lg:hidden">
              {users.map((user) => <MobileUserCard key={user.id} user={user} />)}
            </div>
          </>
        ) : (
          <EmptyState icon={<Users size={24} />} title="Keine Benutzer gefunden" description="Passe Suche oder Filter an." />
        )}
      </div>
    </AppLayout>
  );
}

type UserListItem = Awaited<ReturnType<typeof getUserAdminList>>[number];
type UserOptions = Awaited<ReturnType<typeof getUserAdminOptions>>;

function UserFilters({ query, options }: { query: ReturnType<typeof parseUserListQuery>; options: UserOptions }) {
  return (
    <form action="/admin/users" className="surface-panel grid gap-3 p-4 lg:grid-cols-[minmax(12rem,1fr)_repeat(4,minmax(9rem,.6fr))_auto]">
      <label className="master-label">Suche<input name="q" defaultValue={query.q} placeholder="Discord- oder Fahrername" className="form-control mt-2" /></label>
      <label className="master-label">Rolle<select name="role" defaultValue={query.role ?? ""} className="form-control mt-2"><option value="">Alle Rollen</option>{Object.values(Role).map((role) => <option key={role} value={role}>{roleLabels[role]}{role === Role.FiaPresident ? " · Legacy" : ""}</option>)}</select></label>
      <label className="master-label">Liga<select name="leagueId" defaultValue={query.leagueId ?? ""} className="form-control mt-2"><option value="">Alle Ligen</option>{options.leagues.map((league) => <option key={league.id} value={league.id}>{league.code}</option>)}</select></label>
      <label className="master-label">Team<select name="teamId" defaultValue={query.teamId ?? ""} className="form-control mt-2"><option value="">Alle Teams</option>{options.organizations.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label className="master-label">Fahrerstatus<select name="lineupStatus" defaultValue={query.lineupStatus ?? ""} className="form-control mt-2"><option value="">Alle</option><option value={DriverLineupStatus.Primary}>Stammfahrer</option><option value={DriverLineupStatus.Substitute}>Ersatzfahrer</option></select></label>
      <button className="wizard-primary-button self-end">Filtern</button>
    </form>
  );
}

function UserIdentity({ user }: { user: UserListItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl object-cover" /> : <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-800"><Users size={18} /></span>}
      <div className="min-w-0"><strong className="block truncate text-white">{user.discordName}</strong><span className="block truncate text-xs text-slate-500">{user.displayName}</span></div>
    </div>
  );
}

function DesktopUserRow({ user }: { user: UserListItem }) {
  return (
    <tr>
      <td className="px-5 py-4"><UserIdentity user={user} /></td>
      <td className="px-5 py-4">{user.driver ? <div className="flex items-center gap-2"><CountryFlag countryCode={user.driver.countryCode} size="sm" /><span>#{user.driver.number} {user.driver.name}</span></div> : <span className="text-slate-500">Kein Fahrerprofil</span>}</td>
      <td className="px-5 py-4 text-slate-300">{user.driver ? `${user.driver.assignment?.league.code ?? user.driver.league.code} · ${user.driver.assignment?.organization?.name ?? user.driver.team?.name ?? "Ohne Team"}` : "–"}</td>
      <td className="max-w-64 px-5 py-4"><div className="flex flex-wrap gap-1">{user.roles.map((role) => <RoleBadge key={role} role={role} />)}</div></td>
      <td className="px-5 py-4 text-xs text-slate-400">{formatLastLogin(user.lastLoginAt)}</td>
      <td className="px-5 py-4"><span className={user.active ? "text-emerald-300" : "text-red-300"}>{user.active ? "Aktiv" : "Gesperrt"}</span></td>
      <td className="px-5 py-4 text-right"><Link href={`/admin/users/${user.id}`} className="wizard-secondary-button px-3"><Eye size={16} /> Öffnen</Link></td>
    </tr>
  );
}

function MobileUserCard({ user }: { user: UserListItem }) {
  return (
    <article className="master-card p-4">
      <UserIdentity user={user} />
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-slate-500">Fahrer</p><p className="mt-1 text-white">{user.driver ? `#${user.driver.number} ${user.driver.name}` : "Nicht verknüpft"}</p></div>
        <div><p className="text-xs text-slate-500">Land</p><div className="mt-1"><CountryFlag countryCode={user.driver?.countryCode} size="sm" showLabel /></div></div>
        <div><p className="text-xs text-slate-500">Liga</p><p className="mt-1 text-white">{user.driver?.assignment?.league.code ?? user.driver?.league.code ?? "–"}</p></div>
        <div><p className="text-xs text-slate-500">Team</p><p className="mt-1 break-words text-white">{user.driver?.assignment?.organization?.name ?? user.driver?.team?.name ?? "Ohne Team"}</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1">{user.roles.map((role) => <RoleBadge key={role} role={role} />)}</div>
      <p className="mt-3 text-xs text-slate-500">Letzte Anmeldung: {formatLastLogin(user.lastLoginAt)}</p>
      <Link href={`/admin/users/${user.id}`} className="wizard-primary-button mt-4 min-h-12 w-full"><ShieldCheck size={17} /> Benutzer öffnen</Link>
    </article>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return <span className={`rounded-full border px-2 py-1 text-[0.65rem] font-bold ${role === Role.FiaPresident ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-blue-500/20 bg-blue-500/10 text-blue-200"}`}>{roleLabels[role]}{role === Role.FiaPresident ? " · Legacy" : ""}</span>;
}

function QualityMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className="surface-panel p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${warning ? "text-amber-300" : "text-white"}`}>{value}</p></div>;
}

function formatLastLogin(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : "Noch keine Sitzung";
}
