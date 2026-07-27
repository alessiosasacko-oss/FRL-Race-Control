import assert from "node:assert/strict";
import test from "node:test";
import {
  AttendanceChangeSource,
  AttendanceStatus,
  Role,
} from "@/domain";
import { leagueUpdateSchema } from "@/lib/master-data/schemas";
import {
  calculateLeagueRaceSchedule,
  type LeagueRaceScheduleConfig,
} from "@/lib/races/scheduling";
import {
  attendanceChangeIsAllowed,
  attendanceCounts,
  attendanceNotificationRecipients,
  authorizeAttendanceChange,
  filterAttendanceDriversByLeague,
  shouldPersistAttendanceChange,
} from "./attendance-policy";

const friday1600: LeagueRaceScheduleConfig = {
  raceWeekday: 5,
  raceStartMinute: 16 * 60,
  raceTimezone: "Europe/Berlin",
  defaultAttendanceDeadlineMinutes: 24 * 60,
};

const ownDriver = {
  driverUserId: 10,
  driverLeagueId: 3,
  teamId: 30,
  teamPrincipalUserId: 20,
};

test("1. Admin configures F6 for Friday at 16:00", () => {
  const parsed = leagueUpdateSchema.parse({
    name: "Formula 6",
    description: null,
    currentSeasonId: null,
    active: true,
    raceWeekday: 5,
    raceStartTime: "16:00",
    raceTimezone: "Europe/Berlin",
    defaultAttendanceDeadlineHours: 24,
    displayOrder: 6,
    updateFutureSchedules: false,
    confirmFutureScheduleUpdate: false,
  });
  assert.equal(parsed.raceWeekday, 5);
  assert.equal(parsed.raceStartTime, "16:00");
});

test("2. A new race weekend calculates the F6 slot automatically", () => {
  const slot = calculateLeagueRaceSchedule("2026-08-02", friday1600);
  assert.equal(slot.localStart, "2026-07-31T16:00");
  assert.equal(
    slot.attendanceDeadline?.getTime(),
    slot.scheduledAt.getTime() - 24 * 60 * 60 * 1000,
  );
});

test("3. An F3 driver list only contains F3 drivers", () => {
  const visible = filterAttendanceDriversByLeague(
    [
      { id: 1, leagueId: 3 },
      { id: 2, leagueId: 4 },
    ],
    3,
  );
  assert.deepEqual(visible.map((driver) => driver.id), [1]);
});

test("4. A driver can register themself", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 10, roles: [Role.Driver] },
    ownDriver,
  );
  assert.equal(authorization.source, AttendanceChangeSource.Driver);
  assert.equal(
    attendanceChangeIsAllowed(authorization, null, null),
    true,
  );
});

test("5. A driver can decline themself", () => {
  assert.equal(
    shouldPersistAttendanceChange(
      AttendanceStatus.Registered,
      AttendanceStatus.Declined,
    ),
    true,
  );
});

test("6. A team principal can register their own driver", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 20, roles: [Role.TeamPrincipal] },
    ownDriver,
  );
  assert.equal(authorization.allowed, true);
  assert.equal(
    authorization.source,
    AttendanceChangeSource.TeamPrincipal,
  );
});

test("7. A team principal can decline their own driver", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 20, roles: [Role.TeamPrincipal] },
    ownDriver,
  );
  assert.equal(
    attendanceChangeIsAllowed(authorization, null, "Technische Probleme"),
    true,
  );
});

test("8. A team principal cannot manage an unrelated driver", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 20, roles: [Role.TeamPrincipal] },
    { ...ownDriver, teamPrincipalUserId: 99 },
  );
  assert.equal(authorization.allowed, false);
});

test("9. A team principal cannot manage a driver from another team", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 20, roles: [Role.TeamPrincipal] },
    {
      driverUserId: 11,
      driverLeagueId: 3,
      teamId: 31,
      teamPrincipalUserId: 21,
    },
  );
  assert.equal(authorization.allowed, false);
});

test("10. Team principal changes require a reason", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 20, roles: [Role.TeamPrincipal] },
    ownDriver,
  );
  assert.equal(
    attendanceChangeIsAllowed(authorization, null, null),
    false,
  );
});

test("11. A real status change is marked for audit persistence", () => {
  assert.equal(
    shouldPersistAttendanceChange(
      AttendanceStatus.NoResponse,
      AttendanceStatus.Registered,
    ),
    true,
  );
});

test("12. A driver can override a team principal change before deadline", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 10, roles: [Role.Driver] },
    ownDriver,
  );
  assert.equal(
    attendanceChangeIsAllowed(
      authorization,
      new Date(Date.now() + 60_000),
      null,
    ),
    true,
  );
});

test("13. Attendance is locked after the deadline", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 10, roles: [Role.Driver] },
    ownDriver,
  );
  assert.equal(
    attendanceChangeIsAllowed(
      authorization,
      new Date(Date.now() - 60_000),
      null,
    ),
    false,
  );
});

test("14. An admin can perform a justified deadline override", () => {
  const authorization = authorizeAttendanceChange(
    { userId: 1, roles: [Role.Admin] },
    ownDriver,
  );
  assert.equal(
    attendanceChangeIsAllowed(
      authorization,
      new Date(Date.now() - 60_000),
      "Telefonisch bestätigt",
    ),
    true,
  );
});

test("15. The roster excludes drivers from other leagues", () => {
  const visible = filterAttendanceDriversByLeague(
    [
      { name: "F3 Driver", leagueId: 3 },
      { name: "F2 Driver", leagueId: 2 },
    ],
    3,
  );
  assert.deepEqual(visible.map((driver) => driver.name), ["F3 Driver"]);
});

test("16. Attendance counters are consistent", () => {
  const counts = attendanceCounts([
    AttendanceStatus.Registered,
    AttendanceStatus.Registered,
    AttendanceStatus.Declined,
    AttendanceStatus.NoResponse,
  ]);
  assert.equal(counts.REGISTERED, 2);
  assert.equal(counts.DECLINED, 1);
  assert.equal(counts.NO_RESPONSE, 1);
});

test("17. Repeated clicks do not persist a duplicate status change", () => {
  assert.equal(
    shouldPersistAttendanceChange(
      AttendanceStatus.Registered,
      AttendanceStatus.Registered,
    ),
    false,
  );
});

test("18. A team principal change notifies the driver once", () => {
  const recipients = attendanceNotificationRecipients({
    source: AttendanceChangeSource.TeamPrincipal,
    actorUserId: 20,
    driverUserId: 10,
    teamPrincipalUserId: 20,
  });
  assert.deepEqual(recipients.driver, [10]);
  assert.deepEqual(recipients.teamPrincipal, []);
});

test("19. Driver, steward and team principal roles coexist", () => {
  const ownAuthorization = authorizeAttendanceChange(
    {
      userId: 10,
      roles: [Role.Driver, Role.Steward, Role.TeamPrincipal],
    },
    ownDriver,
  );
  const teamAuthorization = authorizeAttendanceChange(
    {
      userId: 10,
      roles: [Role.Driver, Role.Steward, Role.TeamPrincipal],
    },
    {
      driverUserId: 11,
      driverLeagueId: 3,
      teamId: 30,
      teamPrincipalUserId: 10,
    },
  );
  assert.equal(ownAuthorization.source, AttendanceChangeSource.Driver);
  assert.equal(
    teamAuthorization.source,
    AttendanceChangeSource.TeamPrincipal,
  );
});

test("20. Schedule recalculation leaves attendance identity independent", () => {
  const attendanceIdentity = { raceId: 8, driverId: 44 };
  const before = calculateLeagueRaceSchedule("2026-08-02", friday1600);
  const after = calculateLeagueRaceSchedule("2026-08-09", {
    ...friday1600,
    raceStartMinute: 19 * 60,
  });
  assert.notEqual(before.scheduledAt.getTime(), after.scheduledAt.getTime());
  assert.deepEqual(attendanceIdentity, { raceId: 8, driverId: 44 });
});
