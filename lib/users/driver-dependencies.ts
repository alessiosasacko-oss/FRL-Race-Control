import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  driverDependencyMessages,
  hasDependencies,
  userDependencyMessages,
  type DriverHistoricalDependencyCounts,
  type UserHistoricalDependencyCounts,
} from "./driver-lifecycle";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type DriverDeletionSnapshot = {
  user: {
    id: number;
    displayName: string;
    roles: string[];
    active: boolean;
  };
  driver: {
    id: number;
    name: string;
    active: boolean;
  } | null;
  removable: {
    seasonAssignments: number;
    accounts: number;
    sessions: number;
    notifications: number;
    settings: number;
    incompleteEvidenceUploads: number;
    retainedSystemAudits: number;
  };
  driverDependencies: DriverHistoricalDependencyCounts;
  userDependencies: UserHistoricalDependencyCounts;
  driverBlockingMessages: string[];
  userBlockingMessages: string[];
  canDeleteDriverProfile: boolean;
  canDeleteUserAndDriver: boolean;
};

export async function getDriverDeletionSnapshot(
  database: DatabaseClient,
  userId: number,
): Promise<DriverDeletionSnapshot | null> {
  const user = await database.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      roles: true,
      active: true,
      driver: { select: { id: true, name: true, active: true } },
    },
  });
  if (!user) return null;
  const driverId = user.driver?.id;

  const [
    standings,
    results,
    attendance,
    attendanceAudits,
    adjustments,
    fiaTickets,
    penaltyProposals,
    decisions,
    seasonAssignments,
    reportedTickets,
    archivedTickets,
    stewardAssignments,
    submittedEvidence,
    completedEvidenceUploads,
    fiaAuditEntries,
    discussionMessages,
    mentions,
    votes,
    voteChanges,
    createdProposals,
    proposalReviews,
    decisionMemberships,
    attendanceSubmissions,
    userAttendanceAudits,
    championshipAdjustments,
    championshipAudits,
    resultPublications,
    resultPenaltyChanges,
    directTeamPrincipals,
    organizationPrincipals,
    announcements,
    automationRetries,
    createdDesignThemes,
    updatedDesignThemes,
    designVersions,
    systemAudits,
    accounts,
    sessions,
    notifications,
    settings,
    incompleteEvidenceUploads,
  ] = await Promise.all([
    driverId ? database.driverStanding.count({ where: { driverId } }) : 0,
    driverId
      ? database.raceResult.count({
          where: { OR: [{ driverId }, { expectedDriverId: driverId }] },
        })
      : 0,
    driverId
      ? database.raceAttendance.count({
          where: { OR: [{ driverId }, { substituteDriverId: driverId }] },
        })
      : 0,
    driverId ? database.attendanceAudit.count({ where: { driverId } }) : 0,
    driverId
      ? database.championshipAdjustment.count({ where: { driverId } })
      : 0,
    driverId ? database.fiaTicketDriver.count({ where: { driverId } }) : 0,
    driverId
      ? database.penaltyProposal.count({ where: { affectedDriverId: driverId } })
      : 0,
    driverId ? database.decision.count({ where: { affectedDriverId: driverId } }) : 0,
    driverId
      ? database.driverSeasonAssignment.count({ where: { driverId } })
      : 0,
    database.fiaTicket.count({ where: { reportedByUserId: userId } }),
    database.fiaTicket.count({ where: { archivedById: userId } }),
    database.fiaTicketSteward.count({ where: { userId } }),
    database.evidence.count({ where: { submittedByUserId: userId } }),
    database.evidenceUpload.count({
      where: {
        userId,
        OR: [{ evidenceId: { not: null } }, { status: "COMPLETED" }],
      },
    }),
    database.fiaTicketAuditLog.count({ where: { actorId: userId } }),
    database.discussionMessage.count({ where: { authorId: userId } }),
    database.discussionMention.count({ where: { userId } }),
    database.vote.count({ where: { voterId: userId } }),
    database.voteChange.count({ where: { changedByUserId: userId } }),
    database.penaltyProposal.count({ where: { creatorId: userId } }),
    database.penaltyProposal.count({
      where: { OR: [{ closedByUserId: userId }, { reviewedByUserId: userId }] },
    }),
    database.decisionSteward.count({ where: { userId } }),
    database.raceAttendance.count({ where: { submittedByUserId: userId } }),
    database.attendanceAudit.count({ where: { changedByUserId: userId } }),
    database.championshipAdjustment.count({ where: { actorId: userId } }),
    database.championshipAudit.count({ where: { actorId: userId } }),
    database.raceResultSession.count({ where: { publishedByUserId: userId } }),
    database.resultPenaltyApplication.count({ where: { createdByUserId: userId } }),
    database.team.count({ where: { principalUserId: userId } }),
    database.teamOrganizationSeason.count({ where: { principalUserId: userId } }),
    database.announcement.count({ where: { createdByUserId: userId } }),
    database.automationJobRun.count({ where: { retryActorId: userId } }),
    database.designTheme.count({ where: { createdById: userId } }),
    database.designTheme.count({ where: { updatedById: userId } }),
    database.designThemeVersion.count({ where: { createdById: userId } }),
    database.systemAuditLog.count({
      where: {
        OR: [
          { actorId: userId },
          { entityType: "User", entityId: userId },
          ...(driverId
            ? [{ entityType: "Driver", entityId: driverId }]
            : []),
        ],
      },
    }),
    database.account.count({ where: { userId } }),
    database.session.count({ where: { userId } }),
    database.notification.count({ where: { userId } }),
    database.userSettings.count({ where: { userId } }),
    database.evidenceUpload.count({
      where: {
        userId,
        evidenceId: null,
        status: { not: "COMPLETED" },
      },
    }),
  ]);

  const driverDependencies: DriverHistoricalDependencyCounts = {
    standings,
    results,
    attendance,
    attendanceAudits,
    adjustments,
    fiaTickets,
    penaltyProposals,
    decisions,
  };
  const userDependencies: UserHistoricalDependencyCounts = {
    reportedTickets,
    archivedTickets,
    stewardAssignments,
    evidence: submittedEvidence + completedEvidenceUploads,
    fiaAuditEntries,
    discussionMessages,
    mentions,
    votes,
    voteChanges,
    proposals: createdProposals,
    proposalReviews,
    decisionMemberships,
    attendanceSubmissions,
    attendanceAudits: userAttendanceAudits,
    championshipChanges: championshipAdjustments + championshipAudits,
    resultPublications,
    resultPenaltyChanges,
    teamPrincipalAssignments: directTeamPrincipals + organizationPrincipals,
    announcements,
    automationRetries,
    designChanges: createdDesignThemes + updatedDesignThemes + designVersions,
  };
  const driverBlockingMessages = driverDependencyMessages(driverDependencies);
  const userBlockingMessages = userDependencyMessages(userDependencies);

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      roles: user.roles,
      active: user.active,
    },
    driver: user.driver,
    removable: {
      seasonAssignments,
      accounts,
      sessions,
      notifications,
      settings,
      incompleteEvidenceUploads,
      retainedSystemAudits: systemAudits,
    },
    driverDependencies,
    userDependencies,
    driverBlockingMessages,
    userBlockingMessages,
    canDeleteDriverProfile: Boolean(driverId) && !hasDependencies(driverDependencies),
    canDeleteUserAndDriver:
      !hasDependencies(driverDependencies) && !hasDependencies(userDependencies),
  };
}
