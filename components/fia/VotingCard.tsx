"use client";

import { useActionState } from "react";
import { Vote as VoteIcon } from "lucide-react";
import {
  PenaltyType,
  TicketStatus,
  penaltyTypeLabels,
} from "@/domain";
import { castFiaVoteAction } from "@/lib/fia/actions";
import {
  initialFiaActionState,
  type FiaTicketDetail,
} from "@/lib/fia/types";
import ActionMessage from "./ActionMessage";

type VotingCardProps = {
  ticketId: number;
  status: FiaTicketDetail["status"];
  votes: FiaTicketDetail["votes"];
  currentUserId: number;
};

export default function VotingCard({
  ticketId,
  status,
  votes,
  currentUserId,
}: VotingCardProps) {
  const currentVote = votes.find(
    (vote) => vote.voter.id === currentUserId,
  );
  const action = castFiaVoteAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(
    action,
    initialFiaActionState,
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <VoteIcon className="text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-white">
          Steward-Bewertungen ({votes.length})
        </h2>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {votes.map((vote) => (
          <article
            key={vote.id}
            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
          >
            <p className="font-semibold text-white">
              {vote.voter.displayName}
            </p>
            <p className="mt-2 text-sm font-medium text-blue-300">
              {penaltyTypeLabels[vote.penaltyType]}
              {vote.penaltyValue !== null ? ` · ${vote.penaltyValue}` : ""}
            </p>
            <p className="mt-3 text-sm text-slate-300">{vote.reason}</p>
          </article>
        ))}
      </div>

      {status === TicketStatus.InReview ? (
        <form action={formAction} className="mt-6 space-y-3 border-t border-slate-800 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              name="penaltyType"
              defaultValue={
                currentVote?.penaltyType ?? PenaltyType.NoFurtherAction
              }
              className="form-control"
            >
              {Object.values(PenaltyType).map((penalty) => (
                <option key={penalty} value={penalty}>
                  {penaltyTypeLabels[penalty]}
                </option>
              ))}
            </select>
            <input
              name="penaltyValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={currentVote?.penaltyValue ?? ""}
              placeholder="Wert (optional)"
              className="form-control"
            />
          </div>
          <textarea
            name="reason"
            rows={4}
            required
            maxLength={5000}
            defaultValue={currentVote?.reason ?? ""}
            placeholder="Begründung der Bewertung…"
            className="form-control"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ActionMessage state={state} />
            <button
              type="submit"
              disabled={pending}
              className="wizard-primary-button"
            >
              {pending ? "Speichert…" : "Bewertung speichern"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-5 text-sm text-slate-400">
          Bewertungen sind nur während der Untersuchung möglich.
        </p>
      )}
    </section>
  );
}
