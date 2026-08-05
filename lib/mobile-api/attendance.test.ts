import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  AttendanceChangeSource,
  AttendanceStatus,
  RaceStatus,
  Role,
} from "@/domain";
import {
  getAttendanceWindowState,
  isDriverAttendanceStatus,
} from "@/lib/attendance/policy";
import { changeDriverAttendance } from "@/lib/attendance/service";
import { serializeCalendarRace } from "./serialization";
import {
  mobileAttendanceQuerySchema,
  mobileAttendanceUpdateSchema,
} from "./schemas";
import { handleMobileRequest } from "./response";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const START = new Date("2026-08-10T18:00:00.000Z");
const OPEN = new Date("2026-08-01T12:00:00.000Z");
const CLOSE = new Date("2026-08-09T18:00:00.000Z");

const serviceSource = readFileSync(
  join(process.cwd(), "lib/attendance/service.ts"),
  "utf8",
);
const mobileSource = readFileSync(
  join(process.cwd(), "lib/mobile-api/attendance.ts"),
  "utf8",
);
const listRouteSource = readFileSync(
  join(process.cwd(), "app/api/mobile/v1/attendance/route.ts"),
  "utf8",
);
const detailRouteSource = readFileSync(
  join(process.cwd(), "app/api/mobile/v1/attendance/[raceId]/route.ts"),
  "utf8",
);
const webActionSource = readFileSync(
  join(process.cwd(), "lib/championship/actions.ts"),
  "utf8",
);

function windowState(overrides: {
  raceStatus?: RaceStatus;
  scheduledAt?: Date;
  opensAt?: Date | null;
  closesAt?: Date | null;
  now?: Date;
} = {}) {
  return getAttendanceWindowState(
    {
      raceStatus: overrides.raceStatus ?? RaceStatus.Scheduled,
      scheduledAt: overrides.scheduledAt ?? START,
      opensAt:
        overrides.opensAt === undefined ? OPEN : overrides.opensAt,
      closesAt:
        overrides.closesAt === undefined ? CLOSE : overrides.closesAt,
    },
    overrides.now ?? NOW,
  );
}

function mockedAttendanceDatabase(
  existingStatus?: AttendanceStatus,
): {
  database: PrismaClient;
  calls: {
    attendanceUpserts: Array<Record<string, unknown>>;
    attendanceAudits: Array<Record<string, unknown>>;
    championshipAudits: Array<Record<string, unknown>>;
    systemAudits: Array<Record<string, unknown>>;
    notifications: Array<Record<string, unknown>>;
    webhooks: Array<Record<string, unknown>>;
  };
} {
  const calls = {
    attendanceUpserts: [] as Array<Record<string, unknown>>,
    attendanceAudits: [] as Array<Record<string, unknown>>,
    championshipAudits: [] as Array<Record<string, unknown>>,
    systemAudits: [] as Array<Record<string, unknown>>,
    notifications: [] as Array<Record<string, unknown>>,
    webhooks: [] as Array<Record<string, unknown>>,
  };
  const existing = existingStatus
    ? {
        id: 50,
        raceId: 7,
        leagueScheduleId: 70,
        driverId: 5,
        substituteDriverId: null,
        representedTeamId: 30,
        submittedByUserId: 10,
        status: existingStatus,
        changeSource: AttendanceChangeSource.Driver,
        changeReason: null,
        changedAt: new Date("2026-08-05T11:00:00.000Z"),
        createdAt: new Date("2026-08-05T11:00:00.000Z"),
        updatedAt: new Date("2026-08-05T11:00:00.000Z"),
      }
    : null;
  const transaction = {
    race: {
      findUnique: async () => ({
        id: 7,
        seasonId: 3,
        name: "Imola",
        circuit: "Imola",
        countryCode: "IT",
        mystery: false,
        scheduledAt: START,
        status: RaceStatus.Scheduled,
        season: {
          leagueId: 1,
          participatingLeagues: [{ id: 1 }],
        },
        leagueSchedules: [
          {
            id: 70,
            leagueId: 1,
            scheduledAt: START,
            attendanceDeadline: CLOSE,
            createdAt: OPEN,
            league: { code: "F1" },
          },
        ],
      }),
    },
    driver: {
      findUnique: async () => ({
        id: 5,
        userId: 10,
        name: "Test Driver",
        active: true,
        leagueId: 1,
        team: {
          id: 30,
          seasonId: 3,
          principalUserId: null,
          organizationId: null,
        },
        seasonAssignments: [
          { seasonId: 3, leagueId: 1, organizationId: null },
        ],
      }),
      findFirst: async () => ({ id: 6 }),
    },
    team: {
      findUnique: async () => ({
        id: 30,
        principalUserId: null,
        organization: null,
      }),
      findFirst: async () => ({ id: 30 }),
    },
    raceAttendance: {
      findUnique: async () => existing,
      findFirst: async () => null,
      upsert: async (input: { update: Record<string, unknown>; create: Record<string, unknown> }) => {
        calls.attendanceUpserts.push(input as unknown as Record<string, unknown>);
        const data = existing ? input.update : input.create;
        return {
          ...(existing ?? {
            id: 50,
            raceId: 7,
            driverId: 5,
            createdAt: NOW,
          }),
          ...data,
          changedAt: data.changedAt ?? NOW,
          updatedAt: NOW,
        };
      },
    },
    attendanceAudit: {
      create: async (input: Record<string, unknown>) => {
        calls.attendanceAudits.push(input);
        return { id: 80 };
      },
    },
    championshipAudit: {
      create: async (input: Record<string, unknown>) => {
        calls.championshipAudits.push(input);
        return input;
      },
    },
    systemAuditLog: {
      create: async (input: Record<string, unknown>) => {
        calls.systemAudits.push(input);
        return input;
      },
    },
    webhookEvent: {
      upsert: async (input: Record<string, unknown>) => {
        calls.webhooks.push(input);
        return input;
      },
    },
    user: {
      findMany: async () => [
        {
          id: 10,
          active: true,
          email: null,
          displayName: "Test Driver",
          settings: null,
        },
      ],
    },
    notification: {
      upsert: async (input: Record<string, unknown>) => {
        calls.notifications.push(input);
        return { id: 90 };
      },
    },
  };
  const database = {
    $transaction: async (
      operation: (client: typeof transaction) => Promise<unknown>,
    ) => operation(transaction),
  } as unknown as PrismaClient;
  return { database, calls };
}

test("1. every attendance route requires the central mobile user", () => {
  assert.match(listRouteSource, /requireMobileAttendanceUser\(request\)/);
  assert.equal(
    detailRouteSource.match(/requireMobileAttendanceUser\(request\)/g)?.length,
    2,
  );
  assert.match(mobileSource, /requireMobileUser\(request,/);
});

test("2. a missing driver profile has a stable error", () => {
  assert.match(mobileSource, /DRIVER_PROFILE_REQUIRED/);
  assert.match(mobileSource, /context\.user\.driver/);
});

test("3. a locked user has a stable error", () => {
  assert.match(mobileSource, /lockedAt !== null/);
  assert.match(mobileSource, /USER_LOCKED/);
});

test("4. an inactive user has a stable error", () => {
  assert.match(mobileSource, /!context\.user\.active/);
  assert.match(mobileSource, /USER_INACTIVE/);
});

test("5. overview queries are pinned to the server-side driver league", () => {
  assert.match(mobileSource, /leagueId: driver\.leagueId/);
  assert.doesNotMatch(listRouteSource, /leagueId|driverId|userId/);
});

test("6. foreign race ids do not return another league schedule", () => {
  assert.match(mobileSource, /raceId_leagueId: \{ raceId, leagueId: driver\.leagueId \}/);
  assert.match(mobileSource, /"RACE_NOT_FOUND"/);
});

test("7. no attendance row serializes as NO_RESPONSE", () => {
  assert.match(
    mobileSource,
    /ownAttendance\?\.status \?\?[\s\S]*AttendanceStatus\.NoResponse/,
  );
});

test("8. REGISTERED is accepted", () => {
  assert.deepEqual(mobileAttendanceUpdateSchema.parse({ status: "REGISTERED" }), {
    status: "REGISTERED",
  });
  assert.equal(isDriverAttendanceStatus(AttendanceStatus.Registered), true);
});

test("9. DECLINED is accepted", () => {
  assert.deepEqual(mobileAttendanceUpdateSchema.parse({ status: "DECLINED" }), {
    status: "DECLINED",
  });
  assert.equal(isDriverAttendanceStatus(AttendanceStatus.Declined), true);
});

test("10. NO_RESPONSE cannot be actively submitted", () => {
  assert.equal(
    mobileAttendanceUpdateSchema.safeParse({ status: "NO_RESPONSE" }).success,
    false,
  );
  assert.equal(isDriverAttendanceStatus(AttendanceStatus.NoResponse), false);
});

test("11. arbitrary attendance statuses are rejected", () => {
  assert.equal(
    mobileAttendanceUpdateSchema.safeParse({ status: "MAYBE" }).success,
    false,
  );
  assert.match(detailRouteSource, /INVALID_ATTENDANCE_STATUS/);
});

test("12. a future opening produces NOT_OPEN", () => {
  const state = windowState({
    opensAt: new Date("2026-08-06T12:00:00.000Z"),
  });
  assert.equal(state.status, "NOT_OPEN");
  assert.equal(state.canRespond, false);
  assert.equal(state.remainingSeconds, 86_400);
});

test("13. an active window produces OPEN", () => {
  const state = windowState();
  assert.equal(state.status, "OPEN");
  assert.equal(state.canRespond, true);
});

test("14. an elapsed deadline produces CLOSED", () => {
  const state = windowState({
    closesAt: new Date("2026-08-05T11:59:59.000Z"),
  });
  assert.equal(state.status, "CLOSED");
  assert.equal(state.canRespond, false);
});

test("15. a started weekend produces RACE_STARTED", () => {
  assert.equal(
    windowState({ scheduledAt: new Date("2026-08-05T11:00:00.000Z") }).status,
    "RACE_STARTED",
  );
  assert.equal(
    windowState({ raceStatus: RaceStatus.InProgress }).status,
    "RACE_STARTED",
  );
});

test("16. a cancelled race produces RACE_CANCELLED", () => {
  assert.equal(
    windowState({ raceStatus: RaceStatus.Cancelled }).status,
    "RACE_CANCELLED",
  );
});

test("17. idempotent updates return before audit creation", () => {
  const idempotentIndex = serviceSource.indexOf("changed: false");
  const auditIndex = serviceSource.indexOf("attendanceAudit.create");
  assert.ok(idempotentIndex > 0);
  assert.ok(idempotentIndex < auditIndex);
});

test("18. real changes write both attendance and championship audits", () => {
  assert.match(serviceSource, /attendanceAudit\.create/);
  assert.match(serviceSource, /championshipAudit\.create/);
  assert.match(serviceSource, /ATTENDANCE_CHANGED/);
});

test("19. mobile self changes use DRIVER as the derived source", () => {
  assert.match(serviceSource, /authorizeAttendanceChange/);
  assert.match(mobileSource, /mode: "SELF"/);
  assert.match(mobileSource, /roles: identity\.roles/);
});

test("20. driver identity is never accepted by the update schema", () => {
  assert.equal(
    mobileAttendanceUpdateSchema.safeParse({
      status: "REGISTERED",
      driverId: 999,
    }).success,
    false,
  );
  assert.doesNotMatch(detailRouteSource, /input\.driverId|parsed\.data\.driverId/);
});

test("21. league identity is never accepted by the update schema", () => {
  assert.equal(
    mobileAttendanceUpdateSchema.safeParse({
      status: "REGISTERED",
      leagueId: 999,
    }).success,
    false,
  );
  assert.doesNotMatch(detailRouteSource, /input\.leagueId|parsed\.data\.leagueId/);
});

test("22. request roles and team ids are rejected", () => {
  assert.equal(
    mobileAttendanceUpdateSchema.safeParse({
      status: "REGISTERED",
      roles: ["ADMIN"],
      teamId: 1,
    }).success,
    false,
  );
});

test("23. attendance uses the existing mystery serializer", () => {
  assert.match(mobileSource, /serializeCalendarRace/);
  const hidden = serializeCalendarRace(
    {
      id: 1,
      name: "Imola",
      circuit: "Autodromo Enzo e Dino Ferrari",
      countryCode: "IT",
      round: 1,
      weekendDate: START,
      scheduledAt: START,
      timezone: "Europe/Berlin",
      status: "SCHEDULED",
      sessions: ["RACE"],
      sprint: false,
      mystery: true,
      track: {
        id: 1,
        name: "Imola",
        countryCode: "IT",
        lengthKm: 4.9,
        lapCount: 63,
        sectorCount: 3,
        smStraightModeZones: 1,
        longestStraightM: 1_000,
        poleSide: "LEFT",
        pitLaneLossSeconds: 20,
        visual: { layoutAsset: "secret.svg" },
      },
      resultSessions: [],
    },
    { id: 1, code: "F1", name: "Formula 1" },
    { id: 1, name: "Season 1" },
    { now: NOW },
  );
  assert.equal(hidden.name, "Mystery Race");
  assert.equal(hidden.circuit, null);
  assert.equal(hidden.track, null);
});

test("24. unknown races have a stable 404 code", () => {
  assert.match(mobileSource, /404,[\s\S]*"RACE_NOT_FOUND"/);
});

test("25. concurrent writes use Serializable transactions and retries", () => {
  assert.match(serviceSource, /TransactionIsolationLevel\.Serializable/);
  assert.match(serviceSource, /code === "P2034"/);
  assert.match(serviceSource, /code === "P2002"/);
  assert.match(serviceSource, /raceId_driverId/);
});

test("26. mobile confirmation notification follows the idempotency exit", () => {
  const idempotentIndex = serviceSource.indexOf("changed: false");
  const notificationIndex = serviceSource.indexOf(
    "attendance-mobile-confirmation",
  );
  assert.ok(notificationIndex > idempotentIndex);
  assert.match(serviceSource, /allowDiscord: false, allowEmail: false/);
});

test("27. the Web attendance action uses the shared service", () => {
  assert.match(webActionSource, /changeDriverAttendance\(\{/);
  assert.match(webActionSource, /origin: "WEB"/);
});

test("28. team-principal Web authorization remains available", () => {
  const policySource = readFileSync(
    join(process.cwd(), "lib/championship/attendance-policy.ts"),
    "utf8",
  );
  assert.match(policySource, /Role\.TeamPrincipal/);
  assert.match(policySource, /teamPrincipalUserId === actor\.userId/);
});

test("29. protected attendance responses are explicitly no-store", () => {
  assert.match(listRouteSource, /mode: "no-store"/);
  assert.equal(detailRouteSource.match(/mode: "no-store"/g)?.length, 2);
});

test("30. access tokens and authorization headers are absent from logs", () => {
  const logCall = serviceSource.match(
    /logger\.error\("Attendance update failed"[\s\S]*?\n\s*\}\);/,
  )?.[0];
  assert.ok(logCall);
  assert.doesNotMatch(logCall, /authorization|accessToken|refreshToken/i);
  assert.doesNotMatch(mobileSource, /logger\.|console\./);
});

test("31. write rate limiting returns the attendance-specific 429 message", async () => {
  const request = new Request("https://example.test/api/mobile/v1/attendance/1", {
    headers: { "x-forwarded-for": "attendance-write-limit" },
  });
  const operation = () => ({ body: { ok: true } });
  const options = {
    rateLimit: { limit: 1, windowMs: 60_000 },
    rateLimitMessage: "Zu viele Änderungen. Bitte versuche es später erneut.",
  };
  assert.equal(
    (await handleMobileRequest(request, "attendance-limit-test", operation, options))
      .status,
    200,
  );
  const limited = await handleMobileRequest(
    request,
    "attendance-limit-test",
    operation,
    options,
  );
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), {
    error: {
      code: "RATE_LIMITED",
      message: options.rateLimitMessage,
    },
  });
});

test("32. unexpected attendance errors expose no stack trace", async () => {
  const request = new Request("https://example.test/api/mobile/v1/attendance", {
    headers: { "x-forwarded-for": "attendance-safe-error" },
  });
  const original = console.error;
  console.error = () => undefined;
  try {
    const response = await handleMobileRequest(
      request,
      "attendance-safe-error-test",
      () => {
        throw new Error("Prisma secret stack");
      },
    );
    const body = JSON.stringify(await response.json());
    assert.equal(response.status, 500);
    assert.doesNotMatch(body, /Prisma|secret|stack/i);
  } finally {
    console.error = original;
  }
});

test("33. overview filters are strict and safely bounded", () => {
  assert.deepEqual(
    mobileAttendanceQuerySchema.parse({
      seasonId: "12",
      status: "COMPLETED",
      upcoming: "false",
    }),
    { seasonId: 12, status: "COMPLETED", upcoming: false },
  );
  assert.equal(
    mobileAttendanceQuerySchema.safeParse({ leagueId: "99" }).success,
    false,
  );
  assert.match(mobileSource, /take: 40/);
});

test("34. mobile replacement fields are preserved, never request-controlled", () => {
  assert.match(serviceSource, /preserveReplacement = input\.origin === "MOBILE"/);
  assert.doesNotMatch(detailRouteSource, /substituteDriverId|representedTeamId/);
});

test("35. real mobile changes produce webhook and system audit records", () => {
  assert.match(serviceSource, /recordWebhookEvent/);
  assert.match(serviceSource, /writeSystemAudit/);
  assert.match(serviceSource, /mobile-attendance-api/);
});

test("36. data revisions cover attendance consumers", () => {
  for (const scope of [
    "attendance",
    "championship",
    "calendar",
    "notifications",
  ]) {
    assert.match(serviceSource, new RegExp(`"${scope}"`));
  }
  assert.match(serviceSource, /revalidatePath\("\/dashboard"\)/);
});

test("37. REGISTERED is persisted with audits and one mobile confirmation", async () => {
  const { database, calls } = mockedAttendanceDatabase();
  const result = await changeDriverAttendance(
    {
      actor: { userId: 10, roles: [Role.Driver] },
      raceId: 7,
      driverId: 5,
      status: AttendanceStatus.Registered,
      mode: "SELF",
      origin: "MOBILE",
      now: NOW,
    },
    { database, revalidate: false },
  );
  assert.equal(result.changed, true);
  assert.equal(result.attendance.status, AttendanceStatus.Registered);
  assert.equal(result.attendance.changeSource, AttendanceChangeSource.Driver);
  assert.equal(calls.attendanceUpserts.length, 1);
  assert.equal(calls.attendanceAudits.length, 1);
  assert.equal(calls.championshipAudits.length, 1);
  assert.equal(calls.systemAudits.length, 1);
  assert.equal(calls.notifications.length, 1);
  assert.equal(calls.webhooks.length, 2);
});

test("38. DECLINED is persisted from the server-derived driver", async () => {
  const { database, calls } = mockedAttendanceDatabase();
  const result = await changeDriverAttendance(
    {
      actor: { userId: 10, roles: [Role.Driver] },
      raceId: 7,
      driverId: 5,
      status: AttendanceStatus.Declined,
      mode: "SELF",
      origin: "MOBILE",
      now: NOW,
    },
    { database, revalidate: false },
  );
  assert.equal(result.attendance.status, AttendanceStatus.Declined);
  const create = calls.attendanceUpserts[0]?.create as
    | Record<string, unknown>
    | undefined;
  assert.equal(create?.driverId, 5);
  assert.equal(create?.submittedByUserId, 10);
  assert.equal(create?.changeSource, AttendanceChangeSource.Driver);
});

test("39. a mocked idempotent REGISTERED produces no side effects", async () => {
  const { database, calls } = mockedAttendanceDatabase(
    AttendanceStatus.Registered,
  );
  const result = await changeDriverAttendance(
    {
      actor: { userId: 10, roles: [Role.Driver] },
      raceId: 7,
      driverId: 5,
      status: AttendanceStatus.Registered,
      mode: "SELF",
      origin: "MOBILE",
      now: NOW,
    },
    { database, revalidate: false },
  );
  assert.equal(result.changed, false);
  assert.equal(calls.attendanceUpserts.length, 0);
  assert.equal(calls.attendanceAudits.length, 0);
  assert.equal(calls.championshipAudits.length, 0);
  assert.equal(calls.systemAudits.length, 0);
  assert.equal(calls.notifications.length, 0);
  assert.equal(calls.webhooks.length, 0);
});
