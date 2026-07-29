import assert from "node:assert/strict";
import test from "node:test";
import {
  PenaltyProposalStatus,
  Role,
  TicketStatus,
} from "@/domain";
import {
  canArchiveFiaTickets,
  fiaArchiveBlockReason,
  isArchivedFiaTicket,
} from "./archive-policy";

const completedTicket = {
  status: TicketStatus.Resolved,
  archivedAt: null,
  hasDecision: true,
  proposalStatuses: [] as PenaltyProposalStatus[],
};

test("a completed ticket with a decision can be archived", () => {
  assert.equal(fiaArchiveBlockReason(completedTicket), null);
});

test("an open ticket cannot be archived", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      status: TicketStatus.Open,
    }),
    "TICKET_NOT_RESOLVED",
  );
});

test("a ticket in review cannot be archived", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      status: TicketStatus.InReview,
    }),
    "TICKET_NOT_RESOLVED",
  );
});

test("a resolved ticket without a final decision cannot be archived", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      hasDecision: false,
    }),
    "FINAL_DECISION_MISSING",
  );
});

test("an open proposal blocks archiving", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      proposalStatuses: [PenaltyProposalStatus.Open],
    }),
    "PROPOSAL_STILL_ACTIVE",
  );
});

test("a proposal awaiting approval blocks archiving", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      proposalStatuses: [PenaltyProposalStatus.AwaitingApproval],
    }),
    "PROPOSAL_STILL_ACTIVE",
  );
});

test("a proposal requiring changes blocks archiving", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      proposalStatuses: [PenaltyProposalStatus.ChangesRequested],
    }),
    "PROPOSAL_STILL_ACTIVE",
  );
});

test("approved proposals do not block archiving", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      proposalStatuses: [PenaltyProposalStatus.Approved],
    }),
    null,
  );
});

test("rejected proposals do not block archiving", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      proposalStatuses: [PenaltyProposalStatus.Rejected],
    }),
    null,
  );
});

test("an already archived ticket cannot be archived twice", () => {
  assert.equal(
    fiaArchiveBlockReason({
      ...completedTicket,
      archivedAt: new Date(),
    }),
    "ALREADY_ARCHIVED",
  );
});

test("a super admin may archive tickets", () => {
  assert.equal(canArchiveFiaTickets([Role.SuperAdmin]), true);
});

test("an admin may archive tickets", () => {
  assert.equal(canArchiveFiaTickets([Role.Admin]), true);
});

test("the FIA president may archive tickets", () => {
  assert.equal(canArchiveFiaTickets([Role.FiaPresident]), true);
});

test("a steward may not archive tickets", () => {
  assert.equal(canArchiveFiaTickets([Role.Steward]), false);
});

test("a driver may not archive tickets", () => {
  assert.equal(canArchiveFiaTickets([Role.Driver]), false);
});

test("a team principal may not archive tickets", () => {
  assert.equal(canArchiveFiaTickets([Role.TeamPrincipal]), false);
});

test("a non-null archive timestamp marks a ticket archived", () => {
  assert.equal(isArchivedFiaTicket("2026-07-29T10:00:00.000Z"), true);
});

test("a null archive timestamp marks a ticket active", () => {
  assert.equal(isArchivedFiaTicket(null), false);
});
