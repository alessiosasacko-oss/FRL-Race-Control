import assert from "node:assert/strict";
import test from "node:test";
import {
  createBootstrapPayload,
  createHealthPayload,
  serializeCalendarRace,
  serializeDriverStanding,
  serializeResultDetail,
  serializeResultOverview,
  serializeTeamStanding,
  toJsonSafe,
} from "./serialization";
import {
  mobileCalendarQuerySchema,
  mobileRaceIdSchema,
  mobileResultsQuerySchema,
} from "./schemas";
import {
  buildCacheControl,
  handleMobileRequest,
  mobileItem,
  mobileList,
} from "./response";

const NOW = new Date("2026-08-04T12:00:00.000Z");

function calendarRace(overrides: {
  mystery?: boolean;
  scheduledAt?: Date;
  publicationStatus?: string;
} = {}): Parameters<typeof serializeCalendarRace>[0] {
  return {
    id: 12,
    name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    countryCode: "BE",
    round: 4,
    weekendDate: new Date("2026-08-09T00:00:00.000Z"),
    scheduledAt:
      overrides.scheduledAt ?? new Date("2026-08-09T18:00:00.000Z"),
    timezone: "Europe/Berlin",
    status: "SCHEDULED",
    sessions: ["QUALIFYING", "RACE"],
    sprint: false,
    mystery: overrides.mystery ?? false,
    track: {
      id: 7,
      name: "Spa-Francorchamps",
      countryCode: "BE",
      lengthKm: 7.004,
      lapCount: 44,
      sectorCount: 3,
      smStraightModeZones: 1,
      longestStraightM: 1024,
      poleSide: "LEFT",
      pitLaneLossSeconds: 22.5,
      visual: { layoutAsset: "https://cdn.example.test/spa.svg" },
    },
    resultSessions: [
      {
        session: "RACE",
        publicationStatus: overrides.publicationStatus ?? "PUBLISHED",
      },
    ],
  };
}

function resultOverview(): Parameters<typeof serializeResultOverview>[0] {
  return {
    id: 12,
    name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    countryCode: "BE",
    scheduledAt: new Date("2026-08-03T18:00:00.000Z"),
    mystery: false,
    season: { id: 3, name: "Season 12" },
    resultSessions: [
      {
        session: "QUALIFYING",
        publicationStatus: "DRAFT",
        results: [],
      },
      {
        session: "RACE",
        publicationStatus: "PUBLISHED",
        results: [
          {
            finalPosition: 1,
            position: 2,
            driver: { id: 5, name: "Public Driver" },
            representedTeam: { id: 9, name: "Public Team" },
          },
        ],
      },
    ],
    resultGraphics: [{ publicUrl: "https://cdn.example.test/result.png" }],
  };
}

function resultDetail(): Parameters<typeof serializeResultDetail>[0] {
  return {
    race: {
      id: 12,
      name: "Belgian Grand Prix",
      circuit: "Circuit de Spa-Francorchamps",
      countryCode: "BE",
      round: 4,
      scheduledAt: "2026-08-03T18:00:00.000Z",
      status: "COMPLETED",
      mystery: false,
      revealMystery: true,
      season: {
        id: 3,
        name: "Season 12",
        league: { id: 2, code: "F2", name: "Formula 2" },
      },
    },
    sessions: [
      {
        session: "QUALIFYING",
        publicationStatus: "DRAFT",
        publishedAt: null,
        results: [],
      },
      {
        session: "RACE",
        publicationStatus: "PUBLISHED",
        publishedAt: "2026-08-03T20:00:00.000Z",
        results: [
          {
            finalPosition: 1,
            position: 2,
            status: "FINISHED",
            totalTimeMs: 5_400_123,
            qualifyingTimeMs: null,
            gapToWinnerMs: 0,
            gapToPreviousMs: 0,
            lapsBehind: 0,
            racePoints: 25,
            bonusPoints: 1,
            fastestLap: true,
            fastestLapMs: 91_200,
            effectivePenaltyMs: 5_000,
            driver: {
              id: 5,
              name: "Public Driver",
              number: 44,
              flag: "🇩🇪",
            },
            representedTeam: {
              id: 9,
              name: "Public Team",
              logoUrl: "https://cdn.example.test/team.png",
            },
          },
        ],
      },
    ],
  };
}

test("health payload contains its contract and no environment secrets", () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://secret-value";
  try {
    const payload = createHealthPayload(NOW);
    assert.deepEqual(payload, {
      ok: true,
      service: "frl-mobile-api",
      version: "v1",
      timestamp: NOW.toISOString(),
    });
    assert.doesNotMatch(JSON.stringify(payload), /secret-value|DATABASE_URL/);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("bootstrap keeps only active leagues", () => {
  const payload = createBootstrapPayload(
    {
      defaultLeague: "F1",
      minimumSupportedAppVersion: "1.0.0",
      maintenance: { enabled: false, message: null },
      leagues: [
        {
          id: 1,
          code: "F1",
          name: "Formula 1",
          active: true,
          activeSeason: { id: 3, name: "Season 12" },
        },
        {
          id: 6,
          code: "F6",
          name: "Formula 6",
          active: false,
          activeSeason: null,
        },
      ],
    },
    NOW,
  );
  assert.deepEqual(payload.leagues.map((league) => league.code), ["F1"]);
  assert.equal(payload.features.authentication, true);
});

test("calendar serialization preserves the selected F2 league", () => {
  const race = serializeCalendarRace(
    calendarRace(),
    { id: 2, code: "F2", name: "Formula 2" },
    { id: 3, name: "Season 12" },
    { now: NOW },
  );
  assert.equal(race.league.code, "F2");
});

test("invalid league syntax produces a safe 400 response", async () => {
  const request = new Request("https://example.test/api/mobile/v1/calendar", {
    headers: { "x-forwarded-for": "test-invalid-league" },
  });
  const response = await handleMobileRequest(request, "test-invalid-league", () => {
    mobileCalendarQuerySchema.parse({ league: "F2!" });
    return { body: {} };
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "INVALID_QUERY",
      message: "Die Anfrageparameter sind ungültig.",
    },
  });
});

test("a mystery race hides every track detail before reveal", () => {
  const race = serializeCalendarRace(
    calendarRace({
      mystery: true,
      scheduledAt: new Date("2026-08-04T14:00:00.000Z"),
    }),
    { id: 2, code: "F2", name: "Formula 2" },
    { id: 3, name: "Season 12" },
    { now: NOW },
  );
  assert.equal(race.name, "Mystery Race");
  assert.equal(race.circuit, null);
  assert.equal(race.country, null);
  assert.equal(race.countryCode, null);
  assert.equal(race.track, null);
});

test("a mystery race reveals the public track after reveal", () => {
  const race = serializeCalendarRace(
    calendarRace({
      mystery: true,
      scheduledAt: new Date("2026-08-04T12:30:00.000Z"),
    }),
    { id: 2, code: "F2", name: "Formula 2" },
    { id: 3, name: "Season 12" },
    { now: NOW },
  );
  assert.equal(race.circuit, "Circuit de Spa-Francorchamps");
  assert.equal(race.track?.layoutUrl, "https://cdn.example.test/spa.svg");
});

test("result overview exposes only published sessions", () => {
  const result = serializeResultOverview(
    resultOverview(),
    { id: 2, code: "F2", name: "Formula 2" },
    NOW,
  );
  assert.deepEqual(result.availableSessions, ["RACE"]);
  assert.equal(result.qualifyingPublished, false);
  assert.equal(result.racePublished, true);
});

test("draft result sessions never appear in result detail", () => {
  const result = serializeResultDetail(resultDetail());
  assert.deepEqual(result.sessions.map((session) => session.session), ["RACE"]);
});

test("driver championship uses persisted points without recalculation", () => {
  const result = serializeDriverStanding({
    position: 1,
    points: 137.5,
    wins: 4,
    podiums: 7,
    substituteStarts: 0,
    driver: {
      id: 5,
      name: "Public Driver",
      number: 44,
      flag: "🇩🇪",
      team: { id: 9, name: "Public Team", logoUrl: null },
    },
  });
  assert.equal(result.points, 137.5);
});

test("TCWM uses persisted team points without recalculation", () => {
  const result = serializeTeamStanding({
    position: 1,
    points: 251.25,
    wins: 8,
    team: { id: 9, name: "Public Team", logoUrl: null },
  });
  assert.equal(result.type, "TEAMS");
  assert.equal(result.points, 251.25);
});

test("Discord IDs and email addresses are excluded by explicit serializers", () => {
  const privateInput = {
    ...resultDetail(),
    email: "private@example.test",
    discordId: "123456789",
  };
  const serialized = JSON.stringify(serializeResultDetail(privateInput));
  assert.doesNotMatch(serialized, /private@example\.test|123456789|discordId|email/);
});

test("FIA ticket and evidence data are excluded from result detail", () => {
  const privateInput = {
    ...resultDetail(),
    fiaTicket: { id: 99, evidenceUrl: "https://private.example.test/video" },
  };
  const serialized = JSON.stringify(serializeResultDetail(privateInput));
  assert.doesNotMatch(serialized, /fiaTicket|evidenceUrl|private\.example/);
});

test("result detail exposes published points and public penalty outcome", () => {
  const result = serializeResultDetail(resultDetail());
  assert.equal(result.sessions[0]?.results[0]?.points, 26);
  assert.equal(result.sessions[0]?.results[0]?.penaltySeconds, 5);
});

test("result limit is capped at 50", () => {
  assert.equal(mobileResultsQuerySchema.parse({ limit: "500" }).limit, 50);
});

test("invalid race IDs are rejected", () => {
  assert.equal(mobileRaceIdSchema.safeParse("0").success, false);
  assert.equal(mobileRaceIdSchema.safeParse("race-1").success, false);
});

test("all calendar date values are ISO strings", () => {
  const race = serializeCalendarRace(
    calendarRace(),
    { id: 2, code: "F2", name: "Formula 2" },
    { id: 3, name: "Season 12" },
    { now: NOW },
  );
  assert.equal(new Date(race.weekendDate).toISOString(), race.weekendDate);
  assert.equal(new Date(race.scheduledAt).toISOString(), race.scheduledAt);
});

test("BigInt and Decimal-like values are JSON safe", () => {
  class Decimal {
    toString() {
      return "12.50";
    }
  }
  const safe = toJsonSafe({ revision: BigInt(12), points: new Decimal() });
  assert.equal(JSON.stringify(safe), '{"revision":"12","points":"12.50"}');
});

test("rate limit returns HTTP 429 with the public error contract", async () => {
  const request = new Request("https://example.test/api/mobile/v1/health", {
    headers: { "x-forwarded-for": "test-rate-limit" },
  });
  const operation = () => ({ body: { ok: true } });
  const options = { rateLimit: { limit: 1, windowMs: 60_000 } };
  assert.equal(
    (await handleMobileRequest(request, "test-rate-limit", operation, options)).status,
    200,
  );
  const limited = await handleMobileRequest(
    request,
    "test-rate-limit",
    operation,
    options,
  );
  assert.equal(limited.status, 429);
  const body = await limited.json();
  assert.equal(body.error.code, "RATE_LIMITED");
});

test("unexpected errors never return stack traces", async () => {
  const request = new Request("https://example.test/api/mobile/v1/health", {
    headers: { "x-forwarded-for": "test-error-contract" },
  });
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const response = await handleMobileRequest(
      request,
      "test-error-contract",
      () => {
        throw new Error("test failure");
      },
    );
    const body = JSON.stringify(await response.json());
    assert.equal(response.status, 500);
    assert.doesNotMatch(body, /stack|test failure|Prisma/i);
  } finally {
    console.error = originalConsoleError;
  }
});

test("response wrappers provide a versioned generated-at meta block", () => {
  assert.deepEqual(mobileList([], { league: "F2", seasonId: 3 }, NOW).meta, {
    apiVersion: "v1",
    generatedAt: NOW.toISOString(),
    league: "F2",
    seasonId: 3,
  });
  assert.equal(mobileItem({ id: 1 }, {}, NOW).meta.apiVersion, "v1");
});

test("mystery cache lifetime ends before its reveal time", () => {
  assert.equal(
    buildCacheControl(
      {
        mode: "public",
        seconds: 60,
        hiddenMysteryRevealTimes: ["2026-08-04T12:00:10.000Z"],
      },
      NOW,
    ),
    "public, max-age=0, s-maxage=9, must-revalidate",
  );
});

test("untrusted browser origins do not receive a CORS grant", async () => {
  const request = new Request("https://example.test/api/mobile/v1/health", {
    headers: {
      origin: "https://untrusted.example.test",
      "x-forwarded-for": "test-cors",
    },
  });
  const response = await handleMobileRequest(request, "test-cors", () => ({
    body: { ok: true },
  }));
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});
