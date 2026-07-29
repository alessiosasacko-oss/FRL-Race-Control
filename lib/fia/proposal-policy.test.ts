import assert from "node:assert/strict";
import test from "node:test";
import {
  DecisionOutcome,
  PenaltyProposalStatus,
  PenaltyType,
  ProposalKind,
  ProposalVoteChoice,
  Role,
} from "@/domain";
import {
  canParticipateInProposal,
  formatPenaltyProposal,
  proposalDeadlineReached,
  proposalOutcome,
  shouldAutoCloseProposal,
  tallyProposalVotes,
} from "./proposal-policy";
import {
  createPenaltyProposalSchema,
  penaltyProposalVoteSchema,
} from "./schemas";

test("proposal vote tally separates approval, rejection and abstention", () => {
  const tally = tallyProposalVotes([
    { choice: ProposalVoteChoice.For },
    { choice: ProposalVoteChoice.For },
    { choice: ProposalVoteChoice.Against },
    { choice: ProposalVoteChoice.Abstain },
  ]);
  assert.deepEqual(tally, {
    for: 2,
    against: 1,
    abstain: 1,
    total: 4,
  });
  assert.equal(
    proposalOutcome(
      PenaltyProposalStatus.Closed,
      tally,
    ),
    "MAJORITY_FOR",
  );
});

test("open votes remain visually open and closed ties are explicit", () => {
  const tie = {
    for: 1,
    against: 1,
    abstain: 2,
    total: 4,
  };
  assert.equal(
    proposalOutcome(PenaltyProposalStatus.Open, tie),
    "OPEN",
  );
  assert.equal(
    proposalOutcome(
      PenaltyProposalStatus.Closed,
      tie,
    ),
    "TIE",
  );
});

test("only assigned stewards and FIA leadership may participate", () => {
  assert.equal(
    canParticipateInProposal({
      roles: [Role.Steward],
      userId: 10,
      assignedStewardIds: [10],
    }),
    true,
  );
  assert.equal(
    canParticipateInProposal({
      roles: [Role.Steward],
      userId: 11,
      assignedStewardIds: [10],
    }),
    false,
  );
  for (const role of [
    Role.FiaPresident,
    Role.Admin,
    Role.SuperAdmin,
  ]) {
    assert.equal(
      canParticipateInProposal({
        roles: [role],
        userId: 99,
        assignedStewardIds: [],
      }),
      true,
    );
  }
  assert.equal(
    canParticipateInProposal({
      roles: [Role.Driver],
      userId: 10,
      assignedStewardIds: [10],
    }),
    false,
  );
});

test("all-required-votes closing condition ignores optional voters", () => {
  assert.equal(
    shouldAutoCloseProposal({
      closeWhenAllVoted: true,
      eligibleVoterIds: [1, 2, 3],
      voterIds: [1, 2, 3, 99],
    }),
    true,
  );
  assert.equal(
    shouldAutoCloseProposal({
      closeWhenAllVoted: true,
      eligibleVoterIds: [1, 2, 3],
      voterIds: [1, 3],
    }),
    false,
  );
});

test("proposal deadlines compare exact instants", () => {
  const now = new Date("2026-07-26T20:00:00.000Z");
  assert.equal(
    proposalDeadlineReached(
      new Date("2026-07-26T19:59:59.999Z"),
      now,
    ),
    true,
  );
  assert.equal(
    proposalDeadlineReached(
      new Date("2026-07-26T20:00:00.001Z"),
      now,
    ),
    false,
  );
});

test("proposal schemas enforce penalty values and vote choices", () => {
  const base = {
    affectedDriverId: 1,
    penaltyType: PenaltyType.TimePenalty,
    penaltyValue: 10,
    reason: "Verursachen einer Kollision",
    durationMinutes: 30,
    closeWhenAllVoted: true,
    evidenceIds: [1, 2],
  };
  assert.equal(createPenaltyProposalSchema.safeParse(base).success, true);
  const structuredVote = createPenaltyProposalSchema.safeParse({
    ...base,
    kind: ProposalKind.General,
    title: "Weitere Untersuchung erforderlich",
    proposedOutcome: DecisionOutcome.NoFurtherInvestigation,
  });
  assert.equal(structuredVote.success, true);
  if (structuredVote.success) {
    assert.equal(structuredVote.data.kind, ProposalKind.General);
    assert.equal(
      structuredVote.data.proposedOutcome,
      DecisionOutcome.NoFurtherInvestigation,
    );
  }
  assert.equal(
    createPenaltyProposalSchema.safeParse({
      ...base,
      penaltyValue: undefined,
    }).success,
    false,
  );
  assert.equal(
    createPenaltyProposalSchema.safeParse({
      ...base,
      penaltyType: PenaltyType.GridPenalty,
      penaltyValue: 3,
    }).success,
    false,
  );
  assert.equal(
    createPenaltyProposalSchema.safeParse({
      ...base,
      penaltyType: PenaltyType.RaceBan,
      penaltyValue: undefined,
    }).success,
    true,
  );
  assert.equal(
    penaltyProposalVoteSchema.safeParse({
      choice: ProposalVoteChoice.Abstain,
    }).success,
    true,
  );
});

test("penalty formatting uses the shared canonical penalty enum", () => {
  assert.equal(
    formatPenaltyProposal(PenaltyType.TimePenalty, 10),
    "+10 Sekunden",
  );
  assert.equal(
    formatPenaltyProposal(PenaltyType.PenaltyPoints, 2),
    "2 Strafpunkte",
  );
  assert.equal(
    formatPenaltyProposal(PenaltyType.QualifyingBan, null),
    "Q-Sperre",
  );
});
