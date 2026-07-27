import {
  PenaltyType,
  PenaltyProposalStatus,
  penaltyTypeLabels,
  ProposalVoteChoice,
  Role,
} from "@/domain";

export type ProposalVoteTally = {
  for: number;
  against: number;
  abstain: number;
  total: number;
};

export type ProposalOutcome =
  | "OPEN"
  | "MAJORITY_FOR"
  | "MAJORITY_AGAINST"
  | "TIE";

export function tallyProposalVotes(
  votes: readonly { choice: ProposalVoteChoice }[],
): ProposalVoteTally {
  const tally: ProposalVoteTally = {
    for: 0,
    against: 0,
    abstain: 0,
    total: votes.length,
  };
  for (const vote of votes) {
    if (vote.choice === ProposalVoteChoice.For) tally.for += 1;
    if (vote.choice === ProposalVoteChoice.Against) {
      tally.against += 1;
    }
    if (vote.choice === ProposalVoteChoice.Abstain) {
      tally.abstain += 1;
    }
  }
  return tally;
}

export function proposalOutcome(
  status: PenaltyProposalStatus,
  tally: ProposalVoteTally,
): ProposalOutcome {
  if (status === PenaltyProposalStatus.Open) return "OPEN";
  if (tally.for > tally.against) return "MAJORITY_FOR";
  if (tally.against > tally.for) return "MAJORITY_AGAINST";
  return "TIE";
}

export function canParticipateInProposal(input: {
  roles: readonly Role[];
  userId: number;
  assignedStewardIds: readonly number[];
}): boolean {
  if (
    input.roles.some((role) =>
      [Role.SuperAdmin, Role.Admin, Role.FiaPresident].includes(role),
    )
  ) {
    return true;
  }
  return (
    input.roles.includes(Role.Steward) &&
    input.assignedStewardIds.includes(input.userId)
  );
}

export function shouldAutoCloseProposal(input: {
  closeWhenAllVoted: boolean;
  eligibleVoterIds: readonly number[];
  voterIds: readonly number[];
}): boolean {
  if (!input.closeWhenAllVoted || input.eligibleVoterIds.length === 0) {
    return false;
  }
  const voters = new Set(input.voterIds);
  return input.eligibleVoterIds.every((userId) => voters.has(userId));
}

export function proposalDeadlineReached(
  closesAt: Date | null,
  now = new Date(),
): boolean {
  return closesAt !== null && closesAt.getTime() <= now.getTime();
}

export function formatPenaltyProposal(
  penaltyType: PenaltyType,
  penaltyValue: number | null,
): string {
  const label = penaltyTypeLabels[penaltyType];
  if (penaltyValue === null) return label;
  if (penaltyType === PenaltyType.TimePenalty) {
    return `+${penaltyValue} Sekunden`;
  }
  if (penaltyType === PenaltyType.PenaltyPoints) {
    return `${penaltyValue} Strafpunkt${penaltyValue === 1 ? "" : "e"}`;
  }
  if (penaltyType === PenaltyType.GridPenalty) {
    return `${penaltyValue} Startplatz${penaltyValue === 1 ? "" : "plätze"}`;
  }
  if (penaltyType === PenaltyType.PointsDeduction) {
    return `-${penaltyValue} Meisterschaftspunkte`;
  }
  return `${label} · ${penaltyValue}`;
}
