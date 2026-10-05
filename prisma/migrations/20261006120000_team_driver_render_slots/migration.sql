-- Additive only. Old results deliberately have no inferred slot.
ALTER TABLE "TeamOrganization"
  ADD COLUMN "driverOneGraphicImageUrl" TEXT,
  ADD COLUMN "driverTwoGraphicImageUrl" TEXT;
ALTER TABLE "DriverSeasonAssignment"
  ADD COLUMN "graphicSlot" INTEGER,
  ADD COLUMN "graphicSlotSince" TIMESTAMP(3),
  ADD CONSTRAINT "DriverSeasonAssignment_graphicSlot_check" CHECK ("graphicSlot" IS NULL OR "graphicSlot" IN (1, 2));
CREATE UNIQUE INDEX "DriverSeasonAssignment_graphicSlot_unique"
  ON "DriverSeasonAssignment" ("seasonId", "leagueId", "organizationId", "graphicSlot")
  WHERE "active" AND "lineupStatus" = 'PRIMARY' AND "graphicSlot" IS NOT NULL;
ALTER TABLE "RaceResult"
  ADD COLUMN "graphicSlot" INTEGER,
  ADD COLUMN "graphicOrganizationId" INTEGER,
  ADD COLUMN "graphicSlotCaptured" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "RaceResult_graphicSlot_check" CHECK (
    ("graphicSlot" IS NULL AND "graphicOrganizationId" IS NULL) OR
    ("graphicSlot" IS NOT NULL AND "graphicSlot" IN (1, 2) AND "graphicOrganizationId" IS NOT NULL)
  );
ALTER TABLE "RaceResult" ALTER COLUMN "graphicSlotCaptured" SET DEFAULT false;

-- One canonical numbering, attached to the existing season/league assignment.
-- Database guard covers ALL assignment writers, including transfers and retirement.
CREATE FUNCTION "frl_guard_graphic_assignment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW."active" OR NEW."lineupStatus" <> 'PRIMARY' OR NEW."organizationId" IS NULL THEN
    NEW."graphicSlot" := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF ROW(NEW."driverId", NEW."seasonId", NEW."leagueId", NEW."organizationId", NEW."active", NEW."lineupStatus")
       IS DISTINCT FROM ROW(OLD."driverId", OLD."seasonId", OLD."leagueId", OLD."organizationId", OLD."active", OLD."lineupStatus") THEN
      NEW."graphicSlot" := NULL;
    END IF;
  END IF;
  IF NEW."graphicSlot" IS NULL THEN
    NEW."graphicSlotSince" := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW."graphicSlotSince" := CURRENT_TIMESTAMP;
  ELSIF NEW."graphicSlot" IS DISTINCT FROM OLD."graphicSlot" THEN
    NEW."graphicSlotSince" := CURRENT_TIMESTAMP;
  ELSE
    NEW."graphicSlotSince" := OLD."graphicSlotSince";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DriverSeasonAssignment_graphic_guard"
  BEFORE INSERT OR UPDATE ON "DriverSeasonAssignment"
  FOR EACH ROW EXECUTE FUNCTION "frl_guard_graphic_assignment"();

-- Capture the represented team, never Driver.teamId. Unknown historical slots
-- remain unknown. Timing guards also protect late entry of old race results.
CREATE FUNCTION "frl_capture_result_graphic_slot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE context RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."graphicSlotCaptured" THEN
    NEW."graphicSlotCaptured" := true;
    IF ROW(NEW."driverId", NEW."representedTeamId", NEW."expectedDriverId", NEW."substitute", NEW."resultSessionId")
       IS NOT DISTINCT FROM ROW(OLD."driverId", OLD."representedTeamId", OLD."expectedDriverId", OLD."substitute", OLD."resultSessionId") THEN
      NEW."graphicSlot" := OLD."graphicSlot";
      NEW."graphicOrganizationId" := OLD."graphicOrganizationId";
    ELSE
      NEW."graphicSlot" := NULL;
      NEW."graphicOrganizationId" := NULL;
    END IF;
    RETURN NEW;
  END IF;
  NEW."graphicSlot" := NULL;
  NEW."graphicOrganizationId" := NULL;
  NEW."graphicSlotCaptured" := false;
  SELECT s."publicationStatus", s."leagueId", r."seasonId",
    COALESCE(ls."scheduledAt", r."scheduledAt") AS "raceTime"
    INTO context FROM "RaceResultSession" s JOIN "Race" r ON r.id = s."raceId"
    LEFT JOIN "RaceLeagueSchedule" ls ON ls."raceId" = r.id AND ls."leagueId" = s."leagueId"
    WHERE s.id = NEW."resultSessionId";
  IF context."publicationStatus" = 'PUBLISHED' THEN
    NEW."graphicSlotCaptured" := true;
    SELECT a."graphicSlot", t."organizationId" INTO NEW."graphicSlot", NEW."graphicOrganizationId"
      FROM "Team" t JOIN "DriverSeasonAssignment" a ON a."organizationId" = t."organizationId"
      JOIN "Driver" d ON d.id = a."driverId"
      WHERE t.id = NEW."representedTeamId" AND t."seasonId" = context."seasonId" AND t."leagueId" = context."leagueId"
        AND a."driverId" = CASE WHEN NEW."substitute" THEN NEW."expectedDriverId" ELSE NEW."driverId" END
        AND a."seasonId" = context."seasonId" AND a."leagueId" = context."leagueId"
        AND a."active" AND d."active" AND a."lineupStatus" = 'PRIMARY' AND a."graphicSlot" IN (1, 2)
        AND a."graphicSlotSince" <= context."raceTime";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "RaceResult_graphic_snapshot"
  BEFORE INSERT OR UPDATE ON "RaceResult"
  FOR EACH ROW EXECUTE FUNCTION "frl_capture_result_graphic_slot"();

CREATE FUNCTION "frl_capture_session_graphic_slots"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."publicationStatus" = 'PUBLISHED' AND OLD."publicationStatus" <> 'PUBLISHED' THEN
    UPDATE "RaceResult" SET "graphicSlotCaptured" = false
      WHERE "resultSessionId" = NEW.id AND NOT "graphicSlotCaptured";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "RaceResultSession_graphic_snapshot"
  AFTER UPDATE OF "publicationStatus" ON "RaceResultSession"
  FOR EACH ROW EXECUTE FUNCTION "frl_capture_session_graphic_slots"();
