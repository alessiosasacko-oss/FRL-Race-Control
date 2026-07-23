"use client";

import { useActionState } from "react";
import { ExternalLink, FileSearch } from "lucide-react";
import {
  EvidenceType,
  evidenceTypeLabels,
} from "@/domain";
import { addFiaEvidenceAction } from "@/lib/fia/actions";
import {
  initialFiaActionState,
  type FiaTicketDetail,
} from "@/lib/fia/types";
import ActionMessage from "./ActionMessage";

type EvidenceCardProps = {
  ticketId: number;
  evidence: FiaTicketDetail["evidence"];
  canAddEvidence: boolean;
};

export default function EvidenceCard({
  ticketId,
  evidence,
  canAddEvidence,
}: EvidenceCardProps) {
  const action = addFiaEvidenceAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(
    action,
    initialFiaActionState,
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <FileSearch className="text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-white">
          Beweise ({evidence.length})
        </h2>
      </div>

      <div className="mt-5 space-y-3">
        {evidence.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900 p-4 transition hover:border-blue-500"
          >
            <div>
              <p className="font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-sm text-slate-400">
                {evidenceTypeLabels[item.type]} ·{" "}
                {item.submittedBy?.displayName ?? "System"}
              </p>
            </div>
            <ExternalLink size={17} className="shrink-0 text-blue-400" />
          </a>
        ))}
        {evidence.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            Noch keine Beweise hinterlegt.
          </p>
        ) : null}
      </div>

      {canAddEvidence ? (
        <form action={formAction} className="mt-6 space-y-3 border-t border-slate-800 pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <select name="type" defaultValue={EvidenceType.Link} className="form-control">
              {Object.values(EvidenceType).map((type) => (
                <option key={type} value={type}>
                  {evidenceTypeLabels[type]}
                </option>
              ))}
            </select>
            <input
              name="label"
              required
              maxLength={160}
              placeholder="Bezeichnung"
              className="form-control"
            />
            <input
              name="url"
              type="url"
              required
              placeholder="https://…"
              className="form-control"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ActionMessage state={state} />
            <button
              type="submit"
              disabled={pending}
              className="wizard-primary-button"
            >
              {pending ? "Speichert…" : "Beweis speichern"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
