"use client";

import { useActionState, useState } from "react";
import { Archive, ArchiveRestore, X } from "lucide-react";
import {
  archiveFiaTicketAction,
  restoreFiaTicketAction,
} from "@/lib/fia/archive-actions";
import { initialFiaActionState } from "@/lib/fia/types";

type ArchiveTicketControlsProps = {
  ticketId: number;
  archived: boolean;
  canArchive: boolean;
};

export default function ArchiveTicketControls({
  ticketId,
  archived,
  canArchive,
}: ArchiveTicketControlsProps) {
  const [confirming, setConfirming] = useState(false);
  const action = archived
    ? restoreFiaTicketAction.bind(null, ticketId)
    : archiveFiaTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(
    action,
    initialFiaActionState,
  );

  if (!canArchive) return null;

  const title = archived
    ? "FIA-Ticket wiederherstellen?"
    : "FIA-Ticket archivieren?";
  const description = archived
    ? "Das Ticket wird wieder in der aktiven FIA-Übersicht angezeigt. Alle bestehenden Inhalte bleiben unverändert."
    : "Das Ticket wird aus der aktiven FIA-Übersicht entfernt und im FIA-Archiv gespeichert. Chat, Videos, Beweise, Abstimmungen und Entscheidungen bleiben vollständig erhalten.";
  const buttonLabel = archived
    ? "Aus Archiv wiederherstellen"
    : "Ticket archivieren";

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="wizard-secondary-button min-h-11 w-full justify-center"
        >
          {archived ? (
            <ArchiveRestore size={17} />
          ) : (
            <Archive size={17} />
          )}
          {buttonLabel}
        </button>
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-red-300">
            {state.message}
          </p>
        ) : null}
      </div>

      {confirming ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-end bg-slate-950/80 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setConfirming(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-dialog-title"
            className="w-full max-w-lg rounded-t-3xl border border-slate-700 bg-[#111827] p-6 shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">FIA Race Control</p>
                <h2
                  id="archive-dialog-title"
                  className="mt-2 text-2xl font-bold text-white"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                aria-label="Dialog schließen"
                className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mt-4 leading-7 text-slate-300">{description}</p>
            <form
              action={formAction}
              className="mt-6 grid gap-3 sm:grid-cols-2"
            >
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="wizard-secondary-button min-h-12 justify-center"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending}
                className="wizard-primary-button min-h-12 justify-center"
              >
                {pending ? "Wird gespeichert …" : buttonLabel}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
