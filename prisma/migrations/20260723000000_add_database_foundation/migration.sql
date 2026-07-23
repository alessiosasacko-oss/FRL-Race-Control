-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DRIVER', 'STEWARD', 'LEAGUE_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('NO_FURTHER_ACTION', 'WARNING', 'REPRIMAND', 'TIME_PENALTY', 'GRID_PENALTY', 'DRIVE_THROUGH', 'STOP_AND_GO', 'DISQUALIFICATION', 'POINTS_DEDUCTION');

-- CreateEnum
CREATE TYPE "RaceSession" AS ENUM ('PRACTICE', 'QUALIFYING', 'SPRINT', 'RACE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'RACE_REMINDER', 'ATTENDANCE', 'FIA_TICKET', 'FIA_DECISION', 'CHAMPIONSHIP');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('LINK', 'IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "discordId" VARCHAR(32),
    "displayName" VARCHAR(160) NOT NULL,
    "avatarUrl" TEXT,
    "roles" "Role"[] DEFAULT ARRAY['DRIVER']::"Role"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "teamId" INTEGER,
    "leagueId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "number" INTEGER NOT NULL,
    "flag" VARCHAR(16) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "shortName" VARCHAR(12) NOT NULL,
    "color" CHAR(7) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "currentSeasonId" INTEGER,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "circuit" VARCHAR(160) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "round" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sessions" "RaceSession"[],
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Championship" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Championship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverStanding" (
    "id" SERIAL NOT NULL,
    "championshipId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "penaltyPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStanding" (
    "id" SERIAL NOT NULL,
    "championshipId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiaTicket" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "raceId" INTEGER NOT NULL,
    "reportedByUserId" INTEGER,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "session" "RaceSession" NOT NULL,
    "lap" INTEGER,
    "corner" VARCHAR(80),
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiaTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiaTicketDriver" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiaTicketDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiaTicketSteward" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiaTicketSteward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "submittedByUserId" INTEGER,
    "type" "EvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionMessage" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscussionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "voterId" INTEGER NOT NULL,
    "penaltyType" "PenaltyType" NOT NULL,
    "penaltyValue" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "penaltyType" "PenaltyType" NOT NULL,
    "penaltyValue" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionSteward" (
    "id" SERIAL NOT NULL,
    "decisionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionSteward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "href" VARCHAR(500),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE INDEX "Driver_leagueId_active_idx" ON "Driver"("leagueId", "active");

-- CreateIndex
CREATE INDEX "Driver_teamId_idx" ON "Driver"("teamId");

-- CreateIndex
CREATE INDEX "Driver_name_idx" ON "Driver"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_leagueId_number_key" ON "Driver"("leagueId", "number");

-- CreateIndex
CREATE INDEX "Team_leagueId_active_idx" ON "Team"("leagueId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Team_leagueId_name_key" ON "Team"("leagueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_leagueId_shortName_key" ON "Team"("leagueId", "shortName");

-- CreateIndex
CREATE UNIQUE INDEX "League_currentSeasonId_key" ON "League"("currentSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "League_code_key" ON "League"("code");

-- CreateIndex
CREATE INDEX "League_active_idx" ON "League"("active");

-- CreateIndex
CREATE INDEX "League_name_idx" ON "League"("name");

-- CreateIndex
CREATE INDEX "Season_leagueId_active_idx" ON "Season"("leagueId", "active");

-- CreateIndex
CREATE INDEX "Season_startsOn_endsOn_idx" ON "Season"("startsOn", "endsOn");

-- CreateIndex
CREATE UNIQUE INDEX "Season_leagueId_name_key" ON "Season"("leagueId", "name");

-- CreateIndex
CREATE INDEX "Race_seasonId_scheduledAt_idx" ON "Race"("seasonId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Race_completed_scheduledAt_idx" ON "Race"("completed", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Race_seasonId_round_key" ON "Race"("seasonId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "Race_seasonId_name_key" ON "Race"("seasonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Championship_seasonId_key" ON "Championship"("seasonId");

-- CreateIndex
CREATE INDEX "Championship_name_idx" ON "Championship"("name");

-- CreateIndex
CREATE INDEX "DriverStanding_driverId_idx" ON "DriverStanding"("driverId");

-- CreateIndex
CREATE INDEX "DriverStanding_championshipId_points_idx" ON "DriverStanding"("championshipId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "DriverStanding_championshipId_driverId_key" ON "DriverStanding"("championshipId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverStanding_championshipId_position_key" ON "DriverStanding"("championshipId", "position");

-- CreateIndex
CREATE INDEX "TeamStanding_teamId_idx" ON "TeamStanding"("teamId");

-- CreateIndex
CREATE INDEX "TeamStanding_championshipId_points_idx" ON "TeamStanding"("championshipId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "TeamStanding_championshipId_teamId_key" ON "TeamStanding"("championshipId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamStanding_championshipId_position_key" ON "TeamStanding"("championshipId", "position");

-- CreateIndex
CREATE INDEX "FiaTicket_leagueId_status_idx" ON "FiaTicket"("leagueId", "status");

-- CreateIndex
CREATE INDEX "FiaTicket_seasonId_status_idx" ON "FiaTicket"("seasonId", "status");

-- CreateIndex
CREATE INDEX "FiaTicket_raceId_status_idx" ON "FiaTicket"("raceId", "status");

-- CreateIndex
CREATE INDEX "FiaTicket_status_priority_createdAt_idx" ON "FiaTicket"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "FiaTicket_reportedByUserId_idx" ON "FiaTicket"("reportedByUserId");

-- CreateIndex
CREATE INDEX "FiaTicketDriver_driverId_ticketId_idx" ON "FiaTicketDriver"("driverId", "ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "FiaTicketDriver_ticketId_driverId_key" ON "FiaTicketDriver"("ticketId", "driverId");

-- CreateIndex
CREATE INDEX "FiaTicketSteward_userId_ticketId_idx" ON "FiaTicketSteward"("userId", "ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "FiaTicketSteward_ticketId_userId_key" ON "FiaTicketSteward"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "Evidence_submittedByUserId_idx" ON "Evidence"("submittedByUserId");

-- CreateIndex
CREATE INDEX "Evidence_ticketId_type_idx" ON "Evidence"("ticketId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_ticketId_url_key" ON "Evidence"("ticketId", "url");

-- CreateIndex
CREATE INDEX "DiscussionMessage_ticketId_createdAt_idx" ON "DiscussionMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionMessage_authorId_idx" ON "DiscussionMessage"("authorId");

-- CreateIndex
CREATE INDEX "Vote_voterId_idx" ON "Vote"("voterId");

-- CreateIndex
CREATE INDEX "Vote_ticketId_penaltyType_idx" ON "Vote"("ticketId", "penaltyType");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_ticketId_voterId_key" ON "Vote"("ticketId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_ticketId_key" ON "Decision"("ticketId");

-- CreateIndex
CREATE INDEX "Decision_penaltyType_idx" ON "Decision"("penaltyType");

-- CreateIndex
CREATE INDEX "Decision_decidedAt_idx" ON "Decision"("decidedAt");

-- CreateIndex
CREATE INDEX "DecisionSteward_userId_decisionId_idx" ON "DecisionSteward"("userId", "decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionSteward_decisionId_userId_key" ON "DecisionSteward"("decisionId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_currentSeasonId_fkey" FOREIGN KEY ("currentSeasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Championship" ADD CONSTRAINT "Championship_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverStanding" ADD CONSTRAINT "DriverStanding_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverStanding" ADD CONSTRAINT "DriverStanding_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "Championship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStanding" ADD CONSTRAINT "TeamStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicket" ADD CONSTRAINT "FiaTicket_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicket" ADD CONSTRAINT "FiaTicket_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicket" ADD CONSTRAINT "FiaTicket_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicket" ADD CONSTRAINT "FiaTicket_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicketDriver" ADD CONSTRAINT "FiaTicketDriver_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicketDriver" ADD CONSTRAINT "FiaTicketDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicketSteward" ADD CONSTRAINT "FiaTicketSteward_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiaTicketSteward" ADD CONSTRAINT "FiaTicketSteward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionSteward" ADD CONSTRAINT "DecisionSteward_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionSteward" ADD CONSTRAINT "DecisionSteward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
