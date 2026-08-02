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

type RemovableDriverData = {
  seasonAssignments: number;
  accounts: number;
  sessions: number;
  notifications: number;
  settings: number;
  incompleteEvidenceUploads: number;
  retainedSystemAudits: number;
};

export type DriverProfileDeletionSnapshot = {
  driver: {
    id: number;
    name: string;
    active: boolean;
    userId: number | null;
  };
  user: {
    id: number;
    displayName: string;
    roles: string[];
    active: boolean;
  } | null;
  removable: RemovableDriverData;
  driverDependencies: DriverHistoricalDependencyCounts;
  driverBlockingMessages: string[];
  canDeleteDriverProfile: boolean;
};

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
  removable: RemovableDriverData;
  driverDependencies: DriverHistoricalDependencyCounts;
  userDependencies: UserHistoricalDependencyCounts;
  driverBlockingMessages: string[];
  userBlockingMessages: string[];
  canDeleteDriverProfile: boolean;
  canDeleteUserAndDriver: boolean;
};

async function getDriverHistoricalState(
  database: DatabaseClient,
  driverId: number,
): Promise<{
  dependencies: DriverHistoricalDependencyCounts;
  seasonAssignments: number;
}> {
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
  ] = await Promise.all([
    database.driverStanding.count({ where: { driverId } }),
    database.raceResult.count({
      where: { OR: [{ driverId }, { expectedDriverId: driverId }] },
    }),
    database.raceAttendance.count({
      where: { OR: [{ driverId }, { substituteDriverId: driverId }] },
    }),
    database.attendanceAudit.count({ where: { driverId } }),
    database.championshipAdjustment.count({ where: { driverId } }),
    database.fiaTicketDriver.count({ where: { driverId } }),
    database.penaltyProposal.count({ where: { affectedDriverId: driverId } }),
    database.decision.count({ where: { affectedDriverId: driverId } }),
    database.driverSeasonAssignment.count({ where: { driverId } }),
  ]);

  return {
    dependencies: {
      standings,
      results,
      attendance,
      attendanceAudits,
      adjustments,
      fiaTickets,
      penaltyProposals,
      decisions,
    },
    seasonAssignments,
  };
}

export async function getDriverDeletionSnapshotByDriverId(
  database: DatabaseClient,
  driverId: number,
): Promise<DriverProfileDeletionSnapshot | null> {
  const driver = await database.driver.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      name: true,
      active: true,
      userId: true,
      user: {
        select: { id: true, displayName: true, roles: true, active: true },
      },
    },
  });
  if (!driver) return null;

  const [historicalState, accountCounts, retainedSystemAudits] = await Promise.all([
    getDriverHistoricalState(database, driver.id),
    driver.userId
      ? Promise.all([
          database.account.count({ where: { userId: driver.userId } }),
          database.session.count({ where: { userId: driver.userId } }),
          database.notification.count({ where: { userId: driver.userId } }),
          database.userSettings.count({ where: { userId: driver.userId } }),
          database.evidenceUpload.count({
            where: {
              userId: driver.userId,
              evidenceId: null,
              status: { not: "COMPLETED" },
            },
          }),
        ])
      : Promise.resolve([0, 0, 0, 0, 0]),
    database.systemAuditLog.count({
      where: {
        OR: [
          { entityType: "Driver", entityId: driver.id },
          ...(driver.userId
            ? [{ entityType: "User", entityId: driver.userId }]
            : []),
        ],
      },
    }),
  ]);
  const driverBlockingMessages = driverDependencyMessages(
    historicalState.dependencies,
  );

  return {
    driver: {
      id: driver.id,
      name: driver.name,
      active: driver.active,
      userId: driver.userId,
    },
    user: driver.user,
    removable: {
      seasonAssignments: historicalState.seasonAssignments,
      accounts: accountCounts[0],
      sessions: accountCounts[1],
      notifications: accountCounts[2],
      settings: accountCounts[3],
      incompleteEvidenceUploads: accountCounts[4],
      retainedSystemAudits,
    },
    driverDependencies: historicalState.dependencies,
    driverBlockingMessages,
    canDeleteDriverProfile: !hasDependencies(historicalState.dependencies),
  };
}

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
    historicalState,
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
    driverId
      ? getDriverHistoricalState(database, driverId)
      : Promise.resolve({
          dependencies: {
            standings: 0,
            results: 0,
            attendance: 0,
            attendanceAudits: 0,
            adjustments: 0,
            fiaTickets: 0,
            penaltyProposals: 0,
            decisions: 0,
          },
          seasonAssignments: 0,
        }),
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

  const driverDependencies = historicalState.dependencies;
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
      seasonAssignments: historicalState.seasonAssignments,
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
