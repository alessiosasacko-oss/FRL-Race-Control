"use client";

import { useActionState } from "react";
import { Megaphone, Send } from "lucide-react";
import {
  NotificationPriority,
  NotificationType,
  notificationPriorityLabels,
  notificationTypeLabels,
} from "@/domain";
import {
  createAdminAnnouncementAction,
} from "@/lib/notifications/actions";
import { initialNotificationActionState } from "@/lib/notifications/types";
import FormMessage from "@/components/ui/FormMessage";

const announcementNotificationTypes = [
  NotificationType.AdminAnnouncement,
  NotificationType.System,
  NotificationType.QualifyingBan,
  NotificationType.RaceBan,
] as const;

const announcementPriorities = Object.values(NotificationPriority);

export default function AnnouncementForm() {
  const [state, action, pending] = useActionState(
    createAdminAnnouncementAction,
    initialNotificationActionState,
  );

  return (
    <form action={action} className="master-card space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-600/15 p-3 text-blue-400">
          <Megaphone size={22} />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-white">
            Mitteilung veröffentlichen
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Sendet eine In-App-Benachrichtigung an alle aktiven Benutzer.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="master-label md:col-span-2">
          Titel
          <input
            name="title"
            required
            maxLength={160}
            className="form-control mt-2"
          />
        </label>
        <label className="master-label md:col-span-2">
          Nachricht
          <textarea
            name="message"
            required
            maxLength={1000}
            rows={5}
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Typ
          <select name="type" className="form-control mt-2">
            {announcementNotificationTypes.map((type) => (
              <option key={type} value={type}>
                {notificationTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Priorität
          <select name="priority" className="form-control mt-2">
            {announcementPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {notificationPriorityLabels[priority]}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label md:col-span-2">
          Interner Link (optional)
          <input
            name="href"
            placeholder="/calendar"
            className="form-control mt-2"
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-300 md:col-span-2">
          <input
            type="checkbox"
            name="email"
            defaultChecked
            className="size-5 accent-blue-600"
          />
          Für Benutzer mit aktivierten E-Mails auch in die Outbox legen
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FormMessage state={state} />
        <button disabled={pending} className="wizard-primary-button">
          <Send size={18} />
          {pending ? "Veröffentlicht…" : "Veröffentlichen"}
        </button>
      </div>
    </form>
  );
}
