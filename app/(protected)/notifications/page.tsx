import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import {
  markAllFiaNotificationsReadAction,
} from "@/lib/fia/actions";
import { getUserFiaNotifications } from "@/lib/fia/queries";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { notificationTypeLabels } from "@/domain";

export default async function NotificationsPage() {
  const user = await requireAuthenticatedUser();
  const notifications = await getUserFiaNotifications(user.id);
  const unreadCount = notifications.filter(
    (notification) => notification.readAt === null,
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Benachrichtigungen
            </h1>
            <p className="mt-2 text-slate-400">
              Entscheidungen und Aktualisierungen aus FIA Race Control.
            </p>
          </div>
          {unreadCount > 0 ? (
            <form action={markAllFiaNotificationsReadAction}>
              <button type="submit" className="wizard-secondary-button">
                <CheckCheck size={18} />
                Alle als gelesen markieren
              </button>
            </form>
          ) : null}
        </div>

        <div className="space-y-3">
          {notifications.map((notification) => {
            const content = (
              <>
                <div
                  className={`rounded-xl p-3 ${
                    notification.readAt
                      ? "bg-slate-800 text-slate-400"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  <Bell size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <h2 className="font-semibold text-white">
                      {notification.title}
                    </h2>
                    <time className="shrink-0 text-xs text-slate-500">
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(notification.createdAt))}
                    </time>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-blue-400">
                    {notificationTypeLabels[notification.type]}
                  </p>
                </div>
              </>
            );
            const className = `flex gap-4 rounded-2xl border p-4 transition sm:p-5 ${
              notification.readAt
                ? "border-slate-800 bg-[#151B24]"
                : "border-blue-500/30 bg-blue-500/5"
            }`;

            return notification.href ? (
              <Link
                key={notification.id}
                href={notification.href}
                className={`${className} hover:border-blue-500`}
              >
                {content}
              </Link>
            ) : (
              <article key={notification.id} className={className}>
                {content}
              </article>
            );
          })}
          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#151B24] p-10 text-center">
              <Bell className="mx-auto text-slate-500" size={28} />
              <h2 className="mt-4 text-xl font-semibold text-white">
                Keine FIA-Benachrichtigungen
              </h2>
              <p className="mt-2 text-slate-400">
                Veröffentlichte Entscheidungen erscheinen hier.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
