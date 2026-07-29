"use client";

import {
  useOptimistic,
  useState,
  useTransition,
} from "react";
import {
  ExternalLink,
  Minus,
  Scale,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  PenaltyProposalStatus,
  ProposalVoteChoice,
  proposalVoteChoiceLabels,
} from "@/domain";
import {
  castPenaltyProposalVoteAction,
  closePenaltyProposalAction,
} from "@/lib/fia/proposal-actions";
import {
  formatPenaltyProposal,
  proposalOutcome,
  tallyProposalVotes,
} from "@/lib/fia/proposal-policy";
import type { FiaTicketDetail } from "@/lib/fia/types";

type Proposal = NonNullable<
  FiaTicketDetail["discussionMessages"][number]["proposal"]
>;

type PenaltyProposalCardProps = {
  proposal: Proposal;
  currentUser: { id: number; displayName: string };
  canVote: boolean;
  canDecide: boolean;
  onRevise: (proposal: Proposal) => void;
};

type OptimisticVote = Proposal["votes"][number];

function visualState(
  proposal: Proposal,
  outcome: ReturnType<typeof proposalOutcome>,
): { border: string; badge: string; label: string } {
  if (proposal.status === PenaltyProposalStatus.Approved) {
    return {
      border: "border-green-500/70 bg-green-500/5",
      badge: "bg-green-500/20 text-green-200",
      label: "Historisch genehmigt",
    };
  }
  if (proposal.status === PenaltyProposalStatus.Rejected) {
    return {
      border: "border-red-500/70 bg-red-500/5",
      badge: "bg-red-500/20 text-red-200",
      label: "Finalisiert · Abgelehnt",
    };
  }
  if (proposal.status === PenaltyProposalStatus.Cancelled) {
    return {
      border: "border-slate-600 bg-slate-800/30",
      badge: "bg-slate-700 text-slate-200",
      label: "Abstimmung abgebrochen",
    };
  }
  if (
    proposal.status === PenaltyProposalStatus.ChangesRequested
  ) {
    return {
      border: "border-orange-500/70 bg-orange-500/5",
      badge: "bg-orange-500/20 text-orange-200",
      label: "Änderungen angefordert",
    };
  }
  if (proposal.status === PenaltyProposalStatus.Open) {
    return {
      border: "border-blue-500/60 bg-blue-500/5",
      badge: "bg-blue-500/20 text-blue-200",
      label: "Abstimmung läuft",
    };
  }
  if (outcome === "MAJORITY_FOR") {
    return {
      border: "border-green-500/60 bg-green-500/5",
      badge: "bg-green-500/20 text-green-200",
      label: "Mehrheit dafür",
    };
  }
  if (outcome === "MAJORITY_AGAINST") {
    return {
      border: "border-red-500/60 bg-red-500/5",
      badge: "bg-red-500/20 text-red-200",
      label: "Mehrheit dagegen",
    };
  }
  return {
    border: "border-orange-500/60 bg-orange-500/5",
    badge: "bg-orange-500/20 text-orange-200",
    label: "Unentschieden",
  };
}

export default function PenaltyProposalCard({
  proposal,
  currentUser,
  canVote,
  canDecide,
  onRevise,
}: PenaltyProposalCardProps) {
  const [voteMessage, setVoteMessage] = useState("");
  const [voteError, setVoteError] = useState(false);
  const [votePending, startVoteTransition] = useTransition();
  const [closePending, startCloseTransition] = useTransition();
  const [optimisticVotes, addOptimisticVote] = useOptimistic<
    OptimisticVote[],
    ProposalVoteChoice
  >(proposal.votes, (current, choice) => [
    ...current.filter(
      (vote) => vote.voter.id !== currentUser.id,
    ),
    {
      id: -currentUser.id,
      choice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      changeCount:
        (current.find(
          (vote) => vote.voter.id === currentUser.id,
        )?.changeCount ?? -1) + 1,
      voter: currentUser,
    },
  ]);
  const tally = tallyProposalVotes(optimisticVotes);
  const outcome = proposalOutcome(proposal.status, tally);
  const visual = visualState(proposal, outcome);
  const currentVote = optimisticVotes.find(
    (vote) => vote.voter.id === currentUser.id,
  );
  const open =
    proposal.status === PenaltyProposalStatus.Open;
  const canClose =
    open && (canVote || canDecide);

  function vote(choice: ProposalVoteChoice): void {
    setVoteMessage("");
    setVoteError(false);
    startVoteTransition(async () => {
      addOptimisticVote(choice);
      const result = await castPenaltyProposalVoteAction(
        proposal.id,
        choice,
      );
      setVoteMessage(result.message);
      setVoteError(result.status === "error");
    });
  }

  function closeVote(): void {
    setVoteMessage("");
    setVoteError(false);
    startCloseTransition(async () => {
      const result = await closePenaltyProposalAction(
        proposal.id,
      );
      setVoteMessage(result.message);
      setVoteError(result.status === "error");
    });
  }

  return (
    <article
      className={`w-full overflow-hidden rounded-2xl border p-4 sm:p-5 ${visual.border}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Scale size={20} className="text-blue-300" />
            <h3 className="font-bold text-white">
              Strafenvorschlag
            </h3>
            <span className="text-xs text-slate-500">
              Revision {proposal.revision}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Erstellt von {proposal.creator.displayName}
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${visual.badge}`}
        >
          {visual.label}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Fahrer</dt>
          <dd className="mt-1 font-semibold text-white">
            <span aria-hidden="true">
              {proposal.affectedDriver.flag}{" "}
            </span>
            {proposal.affectedDriver.name} · #
            {proposal.affectedDriver.number}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Vorschlag</dt>
          <dd className="mt-1 font-semibold text-blue-200">
            {formatPenaltyProposal(
              proposal.penaltyType,
              proposal.penaltyValue,
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="text-xs text-slate-500">Begründung</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">
          {proposal.reason}
        </p>
      </div>

      {proposal.evidence.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {proposal.evidence.map((evidence) =>
            evidence.viewUrl ? (
              <a
                key={evidence.id}
                href={evidence.viewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-medium text-blue-200 hover:border-blue-500"
              >
                <ExternalLink size={14} />
                {evidence.label}
              </a>
            ) : null,
          )}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-slate-700/80 bg-slate-950/50 p-3 text-center">
        <div>
          <p className="text-lg font-bold text-green-300">
            {tally.for}
          </p>
          <p className="text-xs text-slate-400">Dafür</p>
        </div>
        <div>
          <p className="text-lg font-bold text-red-300">
            {tally.against}
          </p>
          <p className="text-xs text-slate-400">Dagegen</p>
        </div>
        <div>
          <p className="text-lg font-bold text-orange-300">
            {tally.abstain}
          </p>
          <p className="text-xs text-slate-400">Enthalten</p>
        </div>
      </div>

      {optimisticVotes.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Abgegebene Stimmen
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {optimisticVotes.map((vote) => (
              <li
                key={vote.id}
                className="rounded-lg bg-slate-900/80 px-3 py-2 text-xs text-slate-300"
              >
                {vote.voter.displayName}:{" "}
                <span className="font-semibold text-white">
                  {proposalVoteChoiceLabels[vote.choice]}
                </span>
                {vote.changeCount > 0
                  ? ` · ${vote.changeCount} Änderung(en)`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open ? (
        <div className="mt-5 border-t border-slate-700/80 pt-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={!canVote || votePending}
              onClick={() => vote(ProposalVoteChoice.For)}
              className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${
                currentVote?.choice === ProposalVoteChoice.For
                  ? "border-green-400 bg-green-500/20 text-green-100"
                  : "border-slate-700 text-slate-200 hover:border-green-500"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <ThumbsUp className="mr-2 inline" size={16} />
              Dafür
            </button>
            <button
              type="button"
              disabled={!canVote || votePending}
              onClick={() =>
                vote(ProposalVoteChoice.Against)
              }
              className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${
                currentVote?.choice ===
                ProposalVoteChoice.Against
                  ? "border-red-400 bg-red-500/20 text-red-100"
                  : "border-slate-700 text-slate-200 hover:border-red-500"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <ThumbsDown className="mr-2 inline" size={16} />
              Dagegen
            </button>
            <button
              type="button"
              disabled={!canVote || votePending}
              onClick={() =>
                vote(ProposalVoteChoice.Abstain)
              }
              className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${
                currentVote?.choice ===
                ProposalVoteChoice.Abstain
                  ? "border-orange-400 bg-orange-500/20 text-orange-100"
                  : "border-slate-700 text-slate-200 hover:border-orange-500"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Minus className="mr-2 inline" size={16} />
              Enthalten
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {proposal.closesAt
                ? `Endet ${new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(proposal.closesAt))}`
                : proposal.closeWhenAllVoted
                  ? "Endet, sobald alle Pflichtstimmen vorliegen."
                  : "Wird manuell geschlossen."}
            </p>
            {canClose ? (
              <button
                type="button"
                disabled={closePending}
                onClick={closeVote}
                className="min-h-10 rounded-lg border border-slate-700 px-3 font-semibold text-slate-200 hover:border-blue-500"
              >
                {closePending
                  ? "Schließt…"
                  : "Abstimmung schließen"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {(proposal.status === PenaltyProposalStatus.Rejected ||
        proposal.status ===
          PenaltyProposalStatus.ChangesRequested) &&
      canVote ? (
        <button
          type="button"
          onClick={() => onRevise(proposal)}
          className="mt-5 min-h-11 w-full rounded-xl border border-orange-500/40 px-4 text-sm font-semibold text-orange-200"
        >
          Neue Revision erstellen
        </button>
      ) : null}

      {proposal.reviewReason ? (
        <p className="mt-4 rounded-xl bg-slate-950/50 p-3 text-sm text-slate-300">
          <span className="font-semibold text-white">
            FIA-Rückmeldung:
          </span>{" "}
          {proposal.reviewReason}
        </p>
      ) : null}

      {voteMessage ? (
        <p
          role={voteError ? "alert" : "status"}
          className={`mt-3 text-sm ${
            voteError ? "text-red-300" : "text-green-300"
          }`}
        >
          {voteMessage}
        </p>
      ) : null}
    </article>
  );
}
