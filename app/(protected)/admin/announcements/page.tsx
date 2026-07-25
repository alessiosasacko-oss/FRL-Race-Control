import { AlertTriangle, Clock3, Pin } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AnnouncementForm from "@/components/notifications/AnnouncementForm";
import { retryAnnouncementAction } from "@/lib/automation/actions";
import { getAnnouncements } from "@/lib/automation/queries";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

function dateTimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

export default async function AnnouncementsAdminPage() {
  await requirePermission(Permission.ManageAutomation);
  const announcements = await getAnnouncements();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Kommunikationszentrale
          </h1>
          <p className="mt-2 text-slate-400">
            App-, Discord- und E-Mail-Mitteilungen sofort oder geplant
            veröffentlichen.
          </p>
        </div>
        <AnnouncementForm defaultScheduledFor={dateTimeLocal(new Date())} />
        <section className="master-card">
          <h2 className="text-xl font-semibold text-white">
            Mitteilungsverlauf
          </h2>
          <div className="mt-5 space-y-3">
            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {announcement.pinned ? (
                        <Pin size={15} className="text-blue-400" />
                      ) : null}
                      <h3 className="font-semibold text-white">
                        {announcement.title}
                      </h3>
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
                        {announcement.status}
                      </span>
                      <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
                        {announcement.target}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-400">
                      {announcement.content}
                    </p>
                    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 size={14} />
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(announcement.scheduledFor))}
                      {" · "}
                      {announcement.author}
                    </p>
                  </div>
                  {announcement.status === "FAILED" ? (
                    <form
                      action={retryAnnouncementAction.bind(
                        null,
                        announcement.id,
                      )}
                    >
                      <button className="wizard-secondary-button">
                        Erneut versuchen
                      </button>
                    </form>
                  ) : null}
                </div>
                {announcement.lastError ? (
                  <p className="mt-3 flex gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                    <AlertTriangle size={17} className="shrink-0" />
                    {announcement.lastError}
                  </p>
                ) : null}
              </article>
            ))}
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400">
                Noch keine Mitteilungen vorhanden.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
