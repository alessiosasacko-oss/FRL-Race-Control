import Link from "next/link";
import {
  Archive,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Trash2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import NotificationIcon from "@/components/notifications/NotificationIcon";
import {
  NotificationPriority,
  NotificationType,
  notificationPriorityLabels,
  notificationTypeLabels,
} from "@/domain";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  archiveNotificationAction,
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "@/lib/notifications/actions";
import {
  getNotificationPageData,
  parseNotificationListQuery,
} from "@/lib/notifications/queries";

type NotificationsPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

function pageHref(
  query: Awaited<ReturnType<typeof parseNotificationListQuery>>,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.state !== "all") params.set("state", query.state);
  if (query.type) params.set("type", query.type);
  if (query.priority) params.set("priority", query.priority);
  params.set("page", String(page));
  return `/notifications?${params.toString()}`;
}

function priorityClass(priority: NotificationPriority): string {
  if (priority === NotificationPriority.Urgent) {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }
  if (priority === NotificationPriority.High) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  if (priority === NotificationPriority.Low) {
    return "border-slate-700 bg-slate-800/60 text-slate-300";
  }
  return "border-blue-500/30 bg-blue-500/10 text-blue-200";
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const user = await requireAuthenticatedUser();
  const query = parseNotificationListQuery(await searchParams);
  const data = await getNotificationPageData(user.id, query);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Notification Center
            </h1>
            <p className="mt-2 text-slate-400">
              {data.unreadCount > 0
                ? `${data.unreadCount} ungelesene Benachrichtigungen`
                : "Du bist auf dem neuesten Stand."}
            </p>
          </div>
          {data.unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button className="wizard-secondary-button">
                <CheckCheck size={18} />
                Alle gelesen
              </button>
            </form>
          ) : null}
        </div>

        <form
          action="/notifications"
          className="master-card grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <label className="master-label xl:col-span-2">
            Suche
            <span className="relative mt-2 block">
              <Search
                size={17}
                className="absolute left-3 top-3.5 text-slate-500"
              />
              <input
                name="q"
                type="search"
                defaultValue={query.q}
                placeholder="Titel oder Beschreibung"
                className="form-control pl-10"
              />
            </span>
          </label>
          <label className="master-label">
            Zustand
            <select
              name="state"
              defaultValue={query.state}
              className="form-control mt-2"
            >
              <option value="all">Aktuell</option>
              <option value="unread">Ungelesen</option>
              <option value="read">Gelesen</option>
              <option value="archived">Archiviert</option>
            </select>
          </label>
          <label className="master-label">
            Typ
            <select
              name="type"
              defaultValue={query.type ?? ""}
              className="form-control mt-2"
            >
              <option value="">Alle Typen</option>
              {Object.values(NotificationType).map((type) => (
                <option key={type} value={type}>
                  {notificationTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Priorität
            <select
              name="priority"
              defaultValue={query.priority ?? ""}
              className="form-control mt-2"
            >
              <option value="">Alle Prioritäten</option>
              {Object.values(NotificationPriority).map((priority) => (
                <option key={priority} value={priority}>
                  {notificationPriorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
          <button className="wizard-primary-button md:col-span-2 xl:col-span-5">
            Filter anwenden
          </button>
        </form>

        <div className="space-y-3">
          {data.items.map((notification) => (
            <article
              key={notification.id}
              className={`group rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:border-blue-500/60 sm:p-5 ${
                notification.readAt
                  ? "border-slate-800 bg-[#151B24]"
                  : "border-blue-500/30 bg-blue-500/5"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${priorityClass(
                    notification.priority,
                  )}`}
                >
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-white">
                          {notification.title}
                        </h2>
                        {!notification.readAt ? (
                          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            Neu
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {notification.message}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-500">
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(notification.createdAt))}
                    </time>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-blue-300">
                      {notificationTypeLabels[notification.type]}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 ${priorityClass(
                        notification.priority,
                      )}`}
                    >
                      {notificationPriorityLabels[notification.priority]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {notification.href ? (
                    <form
                      action={openNotificationAction.bind(
                        null,
                        notification.id,
                      )}
                    >
                      <button
                        className="pagination-link"
                        aria-label="Benachrichtigung öffnen"
                      >
                        <ExternalLink size={16} />
                        Öffnen
                      </button>
                    </form>
                  ) : null}
                  {!notification.readAt ? (
                    <form
                      action={markNotificationReadAction.bind(
                        null,
                        notification.id,
                      )}
                    >
                      <button
                        className="pagination-link"
                        aria-label="Als gelesen markieren"
                      >
                        <Check size={16} />
                      </button>
                    </form>
                  ) : null}
                  {!notification.archivedAt ? (
                    <form
                      action={archiveNotificationAction.bind(
                        null,
                        notification.id,
                      )}
                    >
                      <button
                        className="pagination-link"
                        aria-label="Archivieren"
                      >
                        <Archive size={16} />
                      </button>
                    </form>
                  ) : null}
                  <form
                    action={deleteNotificationAction.bind(
                      null,
                      notification.id,
                    )}
                  >
                    <button
                      className="pagination-link hover:border-red-500 hover:text-red-300"
                      aria-label="Benachrichtigung löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>

        {data.items.length === 0 ? (
          <div className="master-card border-dashed py-12 text-center">
            <Bell className="mx-auto text-slate-500" size={30} />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Keine Benachrichtigungen gefunden
            </h2>
            <p className="mt-2 text-slate-400">
              Passe Suche oder Filter an.
            </p>
          </div>
        ) : null}

        {data.pageCount > 1 ? (
          <nav
            aria-label="Seitennavigation"
            className="flex items-center justify-between"
          >
            {data.page > 1 ? (
              <Link
                href={pageHref(query, data.page - 1)}
                className="pagination-link"
              >
                <ChevronLeft size={16} />
                Zurück
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-slate-400">
              Seite {data.page} von {data.pageCount}
            </span>
            {data.page < data.pageCount ? (
              <Link
                href={pageHref(query, data.page + 1)}
                className="pagination-link"
              >
                Weiter
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </AppLayout>
  );
}
