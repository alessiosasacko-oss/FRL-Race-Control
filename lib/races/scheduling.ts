import { zonedLocalToUtc } from "@/lib/master-data/timezone";

export const weekdayLabels = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

export type LeagueRaceScheduleConfig = {
  raceWeekday: number;
  raceStartMinute: number;
  raceTimezone: string;
  defaultAttendanceDeadlineMinutes: number | null;
};

export type CalculatedLeagueRaceSchedule = {
  localStart: string;
  scheduledAt: Date;
  attendanceDeadline: Date | null;
  timezone: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatStartMinute(startMinute: number): string {
  const hour = Math.floor(startMinute / 60);
  const minute = startMinute % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

export function calculateLeagueRaceSchedule(
  weekendDate: string,
  config: LeagueRaceScheduleConfig,
): CalculatedLeagueRaceSchedule {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekendDate)) {
    throw new Error("INVALID_WEEKEND_DATE");
  }
  if (
    config.raceWeekday < 1 ||
    config.raceWeekday > 7 ||
    config.raceStartMinute < 0 ||
    config.raceStartMinute > 1439
  ) {
    throw new Error("INVALID_LEAGUE_SCHEDULE");
  }

  const reference = new Date(`${weekendDate}T00:00:00.000Z`);
  if (Number.isNaN(reference.getTime())) {
    throw new Error("INVALID_WEEKEND_DATE");
  }

  const referenceWeekday = reference.getUTCDay() || 7;
  reference.setUTCDate(
    reference.getUTCDate() + config.raceWeekday - referenceWeekday,
  );
  const localDate = `${reference.getUTCFullYear()}-${pad(
    reference.getUTCMonth() + 1,
  )}-${pad(reference.getUTCDate())}`;
  const localStart = `${localDate}T${formatStartMinute(
    config.raceStartMinute,
  )}`;
  const scheduledAt = zonedLocalToUtc(
    localStart,
    config.raceTimezone,
  );
  const attendanceDeadline =
    config.defaultAttendanceDeadlineMinutes === null
      ? null
      : new Date(
          scheduledAt.getTime() -
            config.defaultAttendanceDeadlineMinutes * 60_000,
        );

  return {
    localStart,
    scheduledAt,
    attendanceDeadline,
    timezone: config.raceTimezone,
  };
}
