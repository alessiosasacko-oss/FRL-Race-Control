import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import {
  notificationTypeLabels,
} from "@/domain";
import type { DashboardData } from "@/lib/dashboard/types";
import { openNotificationAction } from "@/lib/notifications/actions";
import DashboardCard from "./DashboardCard";

export default function NotificationsWidget({
  notifications,
}: {
  notifications: DashboardData["notifications"];
}) {
  return (
    <DashboardCard
      icon={Bell}
      title="Benachrichtigungen"
      className="xl:col-span-2"
    >
      <div className="grid gap-2 md:grid-cols-2">
        {notifications.map((notification) => (
          <form
            key={notification.id}
            action={openNotificationAction.bind(null, notification.id)}
          >
            <button
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-blue-500 ${
                notification.readAt
                  ? "border-slate-800 bg-slate-950/25"
                  : "border-blue-500/25 bg-blue-500/5"
              }`}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${
                  notification.readAt ? "bg-slate-600" : "bg-blue-400"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {notification.title}
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {notificationTypeLabels[notification.type]}
                </span>
              </span>
              <ChevronRight size={16} className="text-slate-500" />
            </button>
          </form>
        ))}
      </div>
      {notifications.length === 0 ? (
        <p className="py-8 text-center text-slate-400">
          Keine aktuellen Benachrichtigungen.
        </p>
      ) : null}
      <Link
        href="/notifications"
        className="mt-4 block text-center text-sm font-semibold text-blue-400 hover:text-blue-300"
      >
        Alle Benachrichtigungen
      </Link>
    </DashboardCard>
  );
}
