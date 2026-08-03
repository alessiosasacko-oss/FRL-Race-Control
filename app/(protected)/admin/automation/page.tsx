import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  ImageIcon,
  Mail,
  RefreshCw,
  ServerCog,
  Webhook,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import DiscordConfigForms from "@/components/automation/DiscordConfigForms";
import DiscordChannelMatrix from "@/components/automation/DiscordChannelMatrix";
import { rerenderResultGraphicAction, retryAutomationJobAction, retryDiscordDeliveryAction } from "@/lib/automation/actions";
import { getAutomationDashboardData } from "@/lib/automation/queries";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

function formatDate(value: string | null): string {
  if (!value) return "Noch nie";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AutomationAdminPage() {
  await requirePermission(Permission.ManageAutomation);
  const data = await getAutomationDashboardData();
  const guild = data.guilds[0];
  const heartbeatFresh = guild?.heartbeatHealthy ?? false;

  const cards = [
    {
      label: "Discord Bot",
      value: heartbeatFresh ? "Online" : guild ? "Offline" : "Nicht konfiguriert",
      detail: guild?.botUsername ?? "Kein Bot-Heartbeat",
      icon: Bot,
      healthy: Boolean(heartbeatFresh),
    },
    {
      label: "Discord Queue",
      value: `${data.queues.discordPending} offen`,
      detail: `${data.queues.discordFailed} fehlgeschlagen`,
      icon: ServerCog,
      healthy: data.queues.discordFailed === 0,
    },
    {
      label: "E-Mail Queue",
      value: `${data.queues.emailPending} offen`,
      detail: `${data.queues.emailFailed} fehlgeschlagen`,
      icon: Mail,
      healthy: data.queues.emailFailed === 0,
    },
    {
      label: "Interne Webhooks",
      value: `${data.queues.pendingWebhooks} offen`,
      detail: process.env.INTERNAL_API_SECRET
        ? "Endpoint geschützt"
        : "Secret fehlt",
      icon: Webhook,
      healthy:
        data.queues.pendingWebhooks === 0 &&
        Boolean(process.env.INTERNAL_API_SECRET),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Automation & Discord
          </h1>
          <p className="mt-2 text-slate-400">
            Bot-Verbindung, Zustellwarteschlangen, geplante Jobs und
            Integrationszustand.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <section key={card.label} className="master-card">
                <div className="flex items-center justify-between">
                  <Icon size={21} className="text-blue-400" />
                  {card.healthy ? (
                    <CheckCircle2 size={18} className="text-green-400" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-400" />
                  )}
                </div>
                <p className="mt-4 text-xs uppercase tracking-widest text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-400">{card.detail}</p>
              </section>
            );
          })}
        </div>

        <DiscordChannelMatrix data={data.discordChannelMatrix} />

        <DiscordConfigForms guilds={data.guilds} leagues={data.leagues} />

        <section className="master-card min-w-0">
          <div className="flex items-center gap-3"><ImageIcon className="text-cyan-400" size={22} /><div><h2 className="text-xl font-semibold text-white">Ergebnisgrafik-Auslieferung</h2><p className="mt-1 text-sm text-slate-400">Liga, Ziel, Render-Version und Discord-Status der letzten Grafiken.</p></div></div>
          <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-2">
            {data.resultGraphicDeliveries.map((delivery) => (
              <article key={delivery.id} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate font-bold text-white">{delivery.league} · {delivery.race}</p><p className="mt-1 break-words text-xs text-slate-500">{delivery.type} · Ergebnis v{delivery.version} · Rendering v{delivery.renderingVersion}</p></div>
                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-bold text-slate-300">{delivery.status}</span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  <div><dt className="text-slate-600">Ziel-Channel</dt><dd className="mt-1 break-all">{delivery.channelId ?? "Noch nicht aufgelöst"}</dd></div>
                  <div><dt className="text-slate-600">Versuche</dt><dd className="mt-1">{delivery.attempts} / 3</dd></div>
                </dl>
                {delivery.lastError ? <p className="mt-3 break-words rounded-lg bg-red-500/10 p-3 text-xs text-red-200">{delivery.lastError}</p> : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <form action={retryDiscordDeliveryAction.bind(null, delivery.id)}><button className="wizard-secondary-button min-h-11 w-full justify-center"><RefreshCw size={16} />Discord erneut senden</button></form>
                  <form action={rerenderResultGraphicAction.bind(null, delivery.graphicId)}><button className="wizard-secondary-button min-h-11 w-full justify-center"><RefreshCw size={16} />Neu rendern</button></form>
                  {delivery.publicUrl ? <a href={delivery.publicUrl} download className="wizard-secondary-button min-h-11 justify-center"><Download size={16} />Herunterladen</a> : <span className="grid min-h-11 place-items-center text-xs text-slate-600">Noch keine Datei</span>}
                </div>
              </article>
            ))}
          </div>
          {data.resultGraphicDeliveries.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">Noch keine Ergebnisgrafiken an Discord ausgeliefert.</p> : null}
        </section>

        {guild ? (
          <section className="master-card">
            <h2 className="text-xl font-semibold text-white">
              Aktive Zuordnungen
            </h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">
                  Kanäle
                </h3>
                <div className="mt-3 space-y-2">
                  {guild.channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300"
                    >
                      {channel.channelName ?? channel.channelId}
                      <span className="ml-2 text-xs text-slate-500">
                        {channel.purpose} · {channel.scopeKey}
                      </span>
                    </div>
                  ))}
                  {guild.channels.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Noch keine Kanäle zugeordnet.
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-300">
                  Rollen
                </h3>
                <div className="mt-3 space-y-2">
                  {guild.roles.map((role) => (
                    <div
                      key={role.id}
                      className="rounded-lg border border-slate-800 p-3 text-sm text-slate-300"
                    >
                      {role.discordRoleName ?? role.discordRoleId}
                      <span className="ml-2 text-xs text-slate-500">
                        {role.role}
                      </span>
                    </div>
                  ))}
                  {guild.roles.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Noch keine Rollen zugeordnet.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-3 lg:hidden" aria-labelledby="mobile-jobs-heading">
          <h2 id="mobile-jobs-heading" className="text-xl font-semibold text-white">
            Geplante Aufgaben
          </h2>
          {data.jobs.map((job) => (
            <article key={job.id} className="master-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-white">{job.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {job.status} · alle {job.intervalMinutes} Min.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">
                  {job.status}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Letzter Lauf</dt>
                  <dd className="mt-1 text-slate-300">{formatDate(job.lastRunAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Nächster Lauf</dt>
                  <dd className="mt-1 text-slate-300">{formatDate(job.nextRunAt)}</dd>
                </div>
              </dl>
              {job.lastError ? (
                <p className="mt-3 break-words rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
                  {job.lastError}
                </p>
              ) : null}
              <form action={retryAutomationJobAction.bind(null, job.id)} className="mt-4">
                <button
                  disabled={job.status === "RUNNING"}
                  className="wizard-secondary-button min-h-12 w-full"
                >
                  <RefreshCw size={15} />
                  Einplanen
                </button>
              </form>
            </article>
          ))}
          {data.jobs.length === 0 ? (
            <p className="master-card text-sm text-amber-300">
              Die Standardjobs werden beim ersten Worker-Lauf oder durch die Migration angelegt.
            </p>
          ) : null}
        </section>

        <section className="master-card hidden overflow-x-auto lg:block">
          <h2 className="text-xl font-semibold text-white">
            Geplante Aufgaben
          </h2>
          <table className="mt-5 w-full min-w-[850px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3">Aufgabe</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Intervall</th>
                <th className="pb-3">Letzter Lauf</th>
                <th className="pb-3">Nächster Lauf</th>
                <th className="pb-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-800">
                  <td className="py-4">
                    <p className="font-medium text-white">{job.name}</p>
                    {job.lastError ? (
                      <p className="mt-1 max-w-md truncate text-xs text-red-300">
                        {job.lastError}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-4 text-slate-300">{job.status}</td>
                  <td className="py-4 text-slate-400">
                    {job.intervalMinutes} Min.
                  </td>
                  <td className="py-4 text-slate-400">
                    {formatDate(job.lastRunAt)}
                  </td>
                  <td className="py-4 text-slate-400">
                    {formatDate(job.nextRunAt)}
                  </td>
                  <td className="py-4 text-right">
                    <form
                      action={retryAutomationJobAction.bind(null, job.id)}
                    >
                      <button
                        disabled={job.status === "RUNNING"}
                        className="wizard-secondary-button px-3 py-2"
                      >
                        <RefreshCw size={15} />
                        Einplanen
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.jobs.length === 0 ? (
            <p className="mt-5 text-sm text-amber-300">
              Die Standardjobs werden beim ersten Worker-Lauf oder durch die
              Migration angelegt.
            </p>
          ) : null}
        </section>

        <section className="master-card">
          <h2 className="text-xl font-semibold text-white">Letzte Läufe</h2>
          <div className="mt-5 space-y-2">
            {data.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{run.jobName}</p>
                  {run.error ? (
                    <p className="mt-1 text-xs text-red-300">{run.error}</p>
                  ) : null}
                </div>
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock3 size={15} />
                  {run.status} · {formatDate(run.startedAt)}
                </p>
              </div>
            ))}
            {data.recentRuns.length === 0 ? (
              <p className="text-sm text-slate-500">
                Noch keine Läufe protokolliert.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
