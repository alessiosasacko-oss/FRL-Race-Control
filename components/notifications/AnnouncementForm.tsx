"use client";

import { useActionState } from "react";
import { CalendarClock, Megaphone, Pin, Send } from "lucide-react";
import {
  AnnouncementTarget,
  NotificationPriority,
  notificationPriorityLabels,
} from "@/domain";
import { createAnnouncementAction } from "@/lib/automation/actions";
import { initialAutomationActionState } from "@/lib/automation/types";
import FormMessage from "@/components/ui/FormMessage";

const targetLabels: Record<AnnouncementTarget, string> = {
  [AnnouncementTarget.App]: "Nur App",
  [AnnouncementTarget.Discord]: "Nur Discord",
  [AnnouncementTarget.Email]: "Nur E-Mail",
  [AnnouncementTarget.All]: "Alle Kanäle",
};

export default function AnnouncementForm({
  defaultScheduledFor,
}: {
  defaultScheduledFor: string;
}) {
  const [state, action, pending] = useActionState(
    createAnnouncementAction,
    initialAutomationActionState,
  );

  return (
    <form action={action} className="master-card space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-600/15 p-3 text-blue-400">
          <Megaphone size={22} />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-white">
            Mitteilung planen
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Rich-Text-Inhalte unterstützen Discord-Markdown. Die Zustellung
            erfolgt zuverlässig über die gewählten Kanäle.
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
          Inhalt
          <textarea
            name="content"
            required
            maxLength={10000}
            rows={7}
            placeholder="Markdown wie **fett**, Listen und Links wird in Discord unterstützt."
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Ziel
          <select
            name="target"
            defaultValue={AnnouncementTarget.All}
            className="form-control mt-2"
          >
            {Object.values(AnnouncementTarget).map((target) => (
              <option key={target} value={target}>
                {targetLabels[target]}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Priorität
          <select
            name="priority"
            defaultValue={NotificationPriority.Normal}
            className="form-control mt-2"
          >
            {Object.values(NotificationPriority).map((priority) => (
              <option key={priority} value={priority}>
                {notificationPriorityLabels[priority]}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          <span className="flex items-center gap-2">
            <CalendarClock size={16} />
            Veröffentlichung
          </span>
          <input
            name="scheduledFor"
            type="datetime-local"
            required
            defaultValue={defaultScheduledFor}
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Zeitzone
          <input
            name="timezone"
            defaultValue="Europe/Berlin"
            required
            className="form-control mt-2"
          />
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
            name="pinned"
            className="size-5 accent-blue-600"
          />
          <Pin size={17} />
          Mitteilung anpinnen
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FormMessage state={state} />
        <button disabled={pending} className="wizard-primary-button">
          <Send size={18} />
          {pending ? "Plant…" : "Mitteilung einplanen"}
        </button>
      </div>
    </form>
  );
}
