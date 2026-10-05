import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import { resultTeamRenderImage } from "./team-render-slots";
import { hydrateGraphicAssets } from "./result-graphic-storage";
import { ownedTeamDriverRenderPaths } from "@/lib/storage/driver-image-storage";
import { preparedTextGraphic } from "./testing/text-render-fixtures";
import { ResultGraphicType } from "@/domain/enums";
import { resultGraphicSvg } from "./result-graphic-renderer";

const migration = readFileSync("prisma/migrations/20261006120000_team_driver_render_slots/migration.sql", "utf8");

test("team render migration and history guards execute in isolated PostgreSQL", async (t) => {
  const db = new PGlite(); // In-memory only: no DATABASE_URL, filesystem or network.
  try {
    await db.exec(`
      CREATE TABLE "TeamOrganization" (id INT PRIMARY KEY);
      CREATE TABLE "Driver" (id INT PRIMARY KEY, active BOOLEAN NOT NULL DEFAULT true);
      CREATE TABLE "DriverSeasonAssignment" (id INT PRIMARY KEY, "driverId" INT, "seasonId" INT, "leagueId" INT, "organizationId" INT, "lineupStatus" TEXT DEFAULT 'PRIMARY', active BOOLEAN DEFAULT true);
      CREATE TABLE "Team" (id INT PRIMARY KEY, "organizationId" INT, "seasonId" INT, "leagueId" INT);
      CREATE TABLE "Race" (id INT PRIMARY KEY, "seasonId" INT, "scheduledAt" TIMESTAMP);
      CREATE TABLE "RaceLeagueSchedule" ("raceId" INT, "leagueId" INT, "scheduledAt" TIMESTAMP);
      CREATE TABLE "RaceResultSession" (id INT PRIMARY KEY, "raceId" INT, "leagueId" INT, "publicationStatus" TEXT DEFAULT 'DRAFT');
      CREATE TABLE "RaceResult" (id INT PRIMARY KEY, "resultSessionId" INT, "driverId" INT, "representedTeamId" INT, "expectedDriverId" INT, substitute BOOLEAN DEFAULT false);
      INSERT INTO "TeamOrganization" VALUES (10),(20);
      INSERT INTO "Driver"(id) VALUES (1),(2),(3),(4);
      INSERT INTO "Team" VALUES (100,10,7,1),(200,20,7,1);
      INSERT INTO "DriverSeasonAssignment"(id,"driverId","seasonId","leagueId","organizationId") VALUES (1,1,7,1,10),(2,2,7,1,10),(3,3,7,1,20);
      INSERT INTO "Race" VALUES (1,7,CURRENT_TIMESTAMP + interval '1 day'),(2,7,'2000-01-01'),(3,7,CURRENT_TIMESTAMP + interval '1 day');
      INSERT INTO "RaceLeagueSchedule" VALUES (3,1,'2000-01-01');
      INSERT INTO "RaceResultSession" VALUES (1,1,1,'PUBLISHED'),(2,1,1,'DRAFT'),(3,2,1,'PUBLISHED'),(4,3,1,'PUBLISHED');
      INSERT INTO "RaceResult"(id,"resultSessionId","driverId","representedTeamId") VALUES (1,1,1,100);
    `);
    await db.exec(migration);
    const snapshot = async (id: number) => (await db.query<{ graphicSlot: number | null; graphicOrganizationId: number | null; graphicSlotCaptured: boolean }>('SELECT "graphicSlot", "graphicOrganizationId", "graphicSlotCaptured" FROM "RaceResult" WHERE id=$1', [id])).rows[0];
    const assignment = async (id: number) => (await db.query<{ graphicSlot: number | null; graphicSlotSince: Date | null }>('SELECT "graphicSlot", "graphicSlotSince" FROM "DriverSeasonAssignment" WHERE id=$1', [id])).rows[0];

    await t.test("legacy results remain unknown and are never inferred on recalculation", async () => {
      assert.deepEqual(await snapshot(1), { graphicSlot: null, graphicOrganizationId: null, graphicSlotCaptured: true });
      await db.exec('UPDATE "DriverSeasonAssignment" SET "graphicSlot"=id WHERE id IN (1,2); UPDATE "RaceResult" SET "driverId"="driverId" WHERE id=1;');
      assert.equal((await snapshot(1)).graphicSlot, null);
    });
    await t.test("driver one and two capture distinct slots on the represented organization", async () => {
      await db.exec('INSERT INTO "RaceResult"(id,"resultSessionId","driverId","representedTeamId") VALUES (2,1,1,100),(3,1,2,100);');
      assert.deepEqual(await snapshot(2), { graphicSlot: 1, graphicOrganizationId: 10, graphicSlotCaptured: true });
      assert.equal((await snapshot(3)).graphicSlot, 2);
    });
    await t.test("slots are unique per organization/league/season and limited to one or two", async () => {
      await assert.rejects(db.exec('UPDATE "DriverSeasonAssignment" SET "graphicSlot"=1 WHERE id=2;'), /unique/i);
      await assert.rejects(db.exec('UPDATE "DriverSeasonAssignment" SET "graphicSlot"=3 WHERE id=2;'), /check/i);
    });
    await t.test("late historical entries and league-specific historic schedules use fallback", async () => {
      await db.exec('INSERT INTO "RaceResult"(id,"resultSessionId","driverId","representedTeamId") VALUES (4,3,1,100),(5,4,1,100);');
      assert.equal((await snapshot(4)).graphicSlot, null);
      assert.equal((await snapshot(5)).graphicSlot, null);
    });
    await t.test("substitute inherits only the explicitly represented primary driver slot", async () => {
      await db.exec('INSERT INTO "RaceResult"(id,"resultSessionId","driverId","representedTeamId","expectedDriverId",substitute) VALUES (6,1,4,100,2,true),(7,1,4,100,NULL,true);');
      assert.equal((await snapshot(6)).graphicSlot, 2);
      assert.equal((await snapshot(7)).graphicSlot, null);
    });
    await t.test("draft rows capture when their session is first published", async () => {
      await db.exec('INSERT INTO "RaceResult"(id,"resultSessionId","driverId","representedTeamId") VALUES (8,2,1,100);');
      assert.equal((await snapshot(8)).graphicSlotCaptured, false);
      await db.exec('UPDATE "RaceResultSession" SET "publicationStatus"=\'PUBLISHED\' WHERE id=2;');
      assert.equal((await snapshot(8)).graphicSlot, 1);
    });
    await t.test("team changes clear current slots without altering historical artwork ownership", async () => {
      await db.exec('UPDATE "DriverSeasonAssignment" SET "organizationId"=20 WHERE id=1; UPDATE "RaceResult" SET "driverId"="driverId" WHERE id=2;');
      assert.deepEqual(await assignment(1), { graphicSlot: null, graphicSlotSince: null });
      assert.deepEqual(await snapshot(2), { graphicSlot: 1, graphicOrganizationId: 10, graphicSlotCaptured: true });
      await db.exec('UPDATE "DriverSeasonAssignment" SET "graphicSlot"=2 WHERE id=1;');
      assert.equal((await snapshot(2)).graphicOrganizationId, 10);
    });
    await t.test("changing represented team invalidates rather than guesses the old snapshot", async () => {
      await db.exec('UPDATE "RaceResult" SET "representedTeamId"=200 WHERE id=2;');
      assert.deepEqual(await snapshot(2), { graphicSlot: null, graphicOrganizationId: null, graphicSlotCaptured: true });
    });
    await t.test("league changes, substitute status and inactivity release numbered slots", async () => {
      await db.exec('UPDATE "DriverSeasonAssignment" SET "leagueId"=2 WHERE id=1;');
      assert.equal((await assignment(1)).graphicSlot, null);
      await db.exec('UPDATE "DriverSeasonAssignment" SET "lineupStatus"=\'SUBSTITUTE\' WHERE id=2;');
      assert.equal((await assignment(2)).graphicSlot, null);
      await db.exec('UPDATE "DriverSeasonAssignment" SET "graphicSlot"=1 WHERE id=3; UPDATE "DriverSeasonAssignment" SET active=false WHERE id=3;');
      assert.deepEqual(await assignment(3), { graphicSlot: null, graphicSlotSince: null });
      assert.equal((await snapshot(3)).graphicSlot, 2);
    });
  } finally { await db.close(); }
});

test("all result templates use the historical team slot with the complete fallback chain", async () => {
  const teams = [{ id: 10, driverOneGraphicImageUrl: "one", driverTwoGraphicImageUrl: "two" }, { id: 20, driverOneGraphicImageUrl: "wrong-current-team", driverTwoGraphicImageUrl: null }];
  assert.equal(resultTeamRenderImage({ graphicSlot: 1, graphicOrganizationId: 10 }, teams), "one");
  assert.equal(resultTeamRenderImage({ graphicSlot: 2, graphicOrganizationId: 10 }, teams), "two");
  assert.equal(resultTeamRenderImage({ graphicSlot: null, graphicOrganizationId: 10 }, teams), null);
  assert.equal(resultTeamRenderImage(undefined, teams), null);
  const rows = await hydrateGraphicAssets([
    { teamLogoUrl: null, teamRenderImageUrl: "one", renderImageUrl: "legacy", imageUrl: "profile" },
    { teamLogoUrl: null, teamRenderImageUrl: "missing", renderImageUrl: "legacy", imageUrl: "profile" },
    { teamLogoUrl: null, teamRenderImageUrl: "missing", renderImageUrl: "missing", imageUrl: "profile" },
    { teamLogoUrl: null, teamRenderImageUrl: null, renderImageUrl: null, imageUrl: null },
  ], async (url) => url === "missing" ? null : url);
  assert.deepEqual(rows.map((row) => row.imageDataUrl), ["one", "legacy", "profile", null]);
  assert.deepEqual(rows.map((row) => row.imageKind), ["render", "render", "profile", "profile"]);
  const one = `data:image/png;base64,${(await sharp({ create: { width: 16, height: 32, channels: 4, background: "#ff278b" } }).png().toBuffer()).toString("base64")}`;
  const two = `data:image/png;base64,${(await sharp({ create: { width: 16, height: 32, channels: 4, background: "#38e8e1" } }).png().toBuffer()).toString("base64")}`;
  for (const template of ["WINNER", "POLE", "FRONT_ROW", "FASTEST_LAP", "PODIUM", "GRID", ResultGraphicType.RaceClassification, ResultGraphicType.QualifyingClassification] as const) {
    const data = await preparedTextGraphic(template);
    assert.ok(data.rows.length > 0);
    const hydrated = await hydrateGraphicAssets(data.rows.map((row) => ({ ...row, imageUrl: null, teamLogoUrl: null, teamRenderImageUrl: resultTeamRenderImage({ graphicSlot: row.name === "Patrick Mahomes" ? 1 : 2, graphicOrganizationId: 10 }, teams) })), async (url) => url === "one" ? one : two);
    data.rows = hydrated;
    data.highlights = data.highlights!.map((driver) => ({ ...driver, ...hydrated.find((row) => row.name === driver.name)! }));
    data.leader = data.highlights[0];
    assert.ok(resultGraphicSvg(data).includes(one), template);
    if (["FRONT_ROW", "PODIUM", "GRID"].includes(template)) assert.ok(resultGraphicSvg(data).includes(two), template);
  }
});

test("team-render cleanup is restricted to the owned organization and slot", () => {
  const previous = { url: process.env.SUPABASE_URL, bucket: process.env.SUPABASE_DRIVER_IMAGE_BUCKET, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = "https://renders.example";
  process.env.SUPABASE_DRIVER_IMAGE_BUCKET = "drivers";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-secret";
  try {
    const url = "https://renders.example/storage/v1/object/public/drivers/team-driver-renders/10/driver-1/abc-123.webp";
    assert.equal(ownedTeamDriverRenderPaths(url, 10, 1).length, 2);
    assert.deepEqual(ownedTeamDriverRenderPaths(url, 10, 2), []);
    assert.deepEqual(ownedTeamDriverRenderPaths(url, 20, 1), []);
    assert.deepEqual(ownedTeamDriverRenderPaths(url.replace("renders.example", "attacker.example"), 10, 1), []);
  } finally {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.bucket === undefined) delete process.env.SUPABASE_DRIVER_IMAGE_BUCKET; else process.env.SUPABASE_DRIVER_IMAGE_BUCKET = previous.bucket;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  }
});

test("team render endpoints enforce admin auth, server storage, concurrency and audit", () => {
  const route = readFileSync("app/api/admin/teams/[id]/driver-renders/[slot]/route.ts", "utf8");
  const guard = readFileSync("lib/graphics/team-render-admin.ts", "utf8");
  const assignment = readFileSync("app/api/admin/teams/[id]/graphic-slots/route.ts", "utf8");
  assert.match(guard, /getCurrentUser/); assert.match(guard, /Permission.ManageMasterData/); assert.match(guard, /origin !== new URL/);
  assert.match(route, /changed.count !== 1/); assert.match(route, /ownedTeamDriverRenderPaths/); assert.match(route, /writeSystemAudit/);
  assert.match(assignment, /isolationLevel: "Serializable"/); assert.match(assignment, /lineupStatus: "PRIMARY"/);
  assert.doesNotMatch(readFileSync("components/master-data/TeamDriverRenders.tsx", "utf8"), /SERVICE_ROLE|createClient/);
});
