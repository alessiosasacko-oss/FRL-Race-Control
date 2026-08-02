import Image from "next/image";
import Link from "next/link";
import { Eye, History, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import PageHeader from "@/components/ui/PageHeader";
import UserAccessOverview from "@/components/users/UserAccessOverview";
import DriverDangerZone from "@/components/users/DriverDangerZone";
import { AccountStatusEditor, RoleEditor, SportAssignmentEditor } from "@/components/users/UserAdminForms";
import { DriverLineupStatus, Role, roleLabels } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getUserAdminDetail, getUserAdminOptions } from "@/lib/users/queries";
import { logUserAdministrationFailure } from "@/lib/users/diagnostics";
import { getDriverDeletionSnapshot } from "@/lib/users/driver-dependencies";
import { getPrismaClient } from "@/lib/db/prisma";

type UserDetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export default async function UserAdminDetailPage({ params, searchParams }: UserDetailProps) {
  const actor = await requirePermission(Permission.ManageUsers);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [user, optionsResult, deletionResult] = await Promise.all([
    getUserAdminDetail(id),
    getUserAdminOptions()
      .then((data) => ({ data, failed: false as const }))
      .catch((error: unknown) => {
        logUserAdministrationFailure("user-detail-options", error);
        return { data: { leagues: [], seasons: [], organizations: [], primaryAssignments: [] }, failed: true as const };
      }),
    getDriverDeletionSnapshot(getPrismaClient(), id)
      .then((data) => ({ data, failed: false as const }))
      .catch((error: unknown) => {
        logUserAdministrationFailure("user-detail-deletion-dependencies", error);
        return { data: null, failed: true as const };
      }),
  ]);
  if (!user) notFound();
  const options = optionsResult.data;
  const optionsWarning = optionsResult.failed;
  const preview = (await searchParams).preview === "1";
  const currentAssignment = user.driver?.assignments.find((assignment) => assignment.active) ?? null;

  return (
    <AppLayout>
      <div className="page-stack page-accent-admin">
        <PageHeader title={user.discordName} eyebrow="Benutzer & Rollen" subtitle="Konto, Systemrollen, sportliche Zuordnung und effektive Rechte." icon={UserRound} backHref="/admin/users" backLabel="Zur Benutzerverwaltung">
          <Link href={preview ? `/admin/users/${user.id}` : `/admin/users/${user.id}?preview=1`} className="wizard-secondary-button"><Eye size={17} />{preview ? "Vorschau schließen" : "Ansicht prüfen"}</Link>
        </PageHeader>
        {optionsWarning ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">Saison-, Liga- oder Teamoptionen sind vorübergehend nicht verfügbar. Konto, Rollen, Berechtigungen und Audit-Historie können weiterhin geprüft werden.</p> : null}

        <section className="surface-panel p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={88} height={88} className="size-20 rounded-2xl object-cover sm:size-22" /> : <span className="flex size-20 items-center justify-center rounded-2xl bg-slate-800"><UserRound size={32} /></span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-2xl font-black text-white">{user.displayName}</h2><span className={user.active ? "text-emerald-300" : "text-red-300"}>{user.active ? "Aktiv" : "Gesperrt"}</span></div>
              <p className="mt-2 text-sm text-slate-400">Discord-ID: {user.discordId ? `${user.discordId.slice(0, 4)}…${user.discordId.slice(-4)}` : "Nicht verfügbar"}</p>
              <p className="mt-1 break-all text-sm text-slate-400">{user.email ?? "Keine E-Mail hinterlegt"}</p>
              <p className="mt-1 text-sm text-slate-500">Letzte Anmeldung: {user.lastLoginAt ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.lastLoginAt)) : "Noch keine Sitzung"}</p>
              <div className="mt-3 flex flex-wrap gap-2">{user.roles.map((role) => <span key={role} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-200">{roleLabels[role]}{role === Role.FiaPresident ? " · Legacy" : ""}</span>)}</div>
            </div>
            {user.driver ? <div className="rounded-xl border border-slate-800 p-4"><CountryFlag countryCode={user.driver.countryCode} size="lg" showLabel /><p className="mt-2 font-bold text-white">#{user.driver.number} {user.driver.name}</p><p className="mt-1 text-xs text-slate-500">{currentAssignment ? `${currentAssignment.league.code} · ${currentAssignment.organization?.name ?? "Kein Team zugeordnet"}` : "Keine aktive Saisonzuordnung"}</p></div> : <p className="text-sm text-slate-500">Kein Fahrerprofil</p>}
          </div>
        </section>

        {preview ? <UserAccessOverview userName={user.displayName} {...user.access} preview /> : (
          <>
            <section className="surface-panel p-5 sm:p-6"><p className="eyebrow">Systemrollen</p><h2 className="mt-2 text-xl font-black text-white">Rollen bearbeiten</h2><div className="mt-5"><RoleEditor userId={user.id} roles={user.roles} actorIsSuperAdmin={actor.roles.includes(Role.SuperAdmin)} /></div></section>
            <section className="surface-panel p-5 sm:p-6"><p className="eyebrow">Sportliche Zuordnung</p><h2 className="mt-2 text-xl font-black text-white">Saison, Liga und Team</h2><div className="mt-5">{optionsWarning ? <p className="text-sm text-slate-400">Die Zuordnungsoptionen sind momentan nicht verfügbar. Bestehende Daten wurden nicht verändert.</p> : <SportAssignmentEditor userId={user.id} displayName={user.displayName} driver={user.driver} assignment={currentAssignment ? { ...currentAssignment, lineupStatus: currentAssignment.lineupStatus as DriverLineupStatus } : null} options={options} />}</div></section>
            <section className="surface-panel p-5 sm:p-6"><p className="eyebrow">Kontostatus</p><h2 className="mt-2 text-xl font-black text-white">Aktivieren oder sperren</h2><div className="mt-5"><AccountStatusEditor userId={user.id} active={user.active} /></div></section>
            {deletionResult.data ? <DriverDangerZone snapshot={deletionResult.data} actorRoles={actor.roles} /> : <section className="rounded-2xl border border-red-500/30 bg-red-950/10 p-5 text-sm text-amber-100">Die Gefahrenzone ist vorübergehend nicht verfügbar, weil die Abhängigkeiten nicht vollständig geprüft werden konnten. Es wurde keine Löschaktion freigegeben.</section>}
            <UserAccessOverview userName={user.displayName} {...user.access} />
            <section className="surface-panel p-5 sm:p-6"><div className="flex items-center gap-2"><History size={19} className="text-blue-300" /><h2 className="text-xl font-black text-white">Audit-Historie</h2></div><div className="mt-5 space-y-3">{user.audit.map((entry) => <article key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><strong className="text-white">{entry.action}</strong><time className="text-xs text-slate-500">{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</time></div><p className="mt-2 text-sm text-slate-400">Durch {entry.actorName}</p></article>)}{user.audit.length === 0 ? <p className="text-sm text-slate-500">Noch keine Verwaltungsänderung protokolliert.</p> : null}</div></section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
