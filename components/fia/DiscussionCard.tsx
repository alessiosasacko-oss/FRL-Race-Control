"use client";

import { useActionState } from "react";
import { MessageSquare } from "lucide-react";
import { addFiaDiscussionMessageAction } from "@/lib/fia/actions";
import {
  initialFiaActionState,
  type FiaTicketDetail,
} from "@/lib/fia/types";
import { TicketStatus } from "@/domain";
import ActionMessage from "./ActionMessage";

type DiscussionCardProps = {
  ticketId: number;
  status: FiaTicketDetail["status"];
  messages: FiaTicketDetail["discussionMessages"];
};

export default function DiscussionCard({
  ticketId,
  status,
  messages,
}: DiscussionCardProps) {
  const action = addFiaDiscussionMessageAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(
    action,
    initialFiaActionState,
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-white">
          Steward-Diskussion ({messages.length})
        </h2>
      </div>

      <div className="mt-5 max-h-96 space-y-3 overflow-y-auto">
        {messages.map((message) => (
          <article
            key={message.id}
            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-white">
                {message.author.displayName}
              </p>
              <time className="text-xs text-slate-500">
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(message.createdAt))}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-slate-300">
              {message.message}
            </p>
          </article>
        ))}
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">
            Die Steward-Diskussion ist noch leer.
          </p>
        ) : null}
      </div>

      {status !== TicketStatus.Resolved ? (
        <form action={formAction} className="mt-5 space-y-3 border-t border-slate-800 pt-5">
          <textarea
            name="message"
            rows={4}
            required
            maxLength={5000}
            placeholder="Interne Steward-Notiz…"
            className="form-control"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ActionMessage state={state} />
            <button
              type="submit"
              disabled={pending}
              className="wizard-primary-button"
            >
              {pending ? "Sendet…" : "Kommentar senden"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
