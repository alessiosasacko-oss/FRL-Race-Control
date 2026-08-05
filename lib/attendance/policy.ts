import { AttendanceStatus, RaceStatus } from "@/domain";

export const attendanceWindowStatuses = [
  "NOT_OPEN",
  "OPEN",
  "CLOSED",
  "RACE_STARTED",
  "RACE_CANCELLED",
] as const;

export type AttendanceWindowStatus =
  (typeof attendanceWindowStatuses)[number];

export const attendanceWindowMessages: Record<
  AttendanceWindowStatus,
  string
> = {
  NOT_OPEN: "Die Rennanmeldung ist noch nicht geöffnet.",
  OPEN: "Du kannst deine Teilnahme jetzt ändern.",
  CLOSED: "Die Rennanmeldung ist geschlossen.",
  RACE_STARTED: "Das Rennwochenende hat bereits begonnen.",
  RACE_CANCELLED: "Dieses Rennen wurde abgesagt.",
};

export type AttendanceWindowState = {
  status: AttendanceWindowStatus;
  message: string;
  canRespond: boolean;
  opensAt: string | null;
  closesAt: string | null;
  remainingSeconds: number;
};

function secondsBetween(later: Date, earlier: Date): number {
  return Math.max(0, Math.ceil((later.getTime() - earlier.getTime()) / 1_000));
}

export function getAttendanceWindowState(
  input: {
    raceStatus: RaceStatus | `${RaceStatus}`;
    scheduledAt: Date;
    opensAt?: Date | null;
    closesAt?: Date | null;
  },
  now = new Date(),
): AttendanceWindowState {
  const opensAt = input.opensAt ?? null;
  const closesAt = input.closesAt ?? null;
  let status: AttendanceWindowStatus;
  let remainingSeconds = 0;

  if (input.raceStatus === RaceStatus.Cancelled) {
    status = "RACE_CANCELLED";
  } else if (
    input.raceStatus === RaceStatus.InProgress ||
    input.raceStatus === RaceStatus.Completed ||
    input.scheduledAt <= now
  ) {
    status = "RACE_STARTED";
  } else if (opensAt && opensAt > now) {
    status = "NOT_OPEN";
    remainingSeconds = secondsBetween(opensAt, now);
  } else if (closesAt && closesAt <= now) {
    status = "CLOSED";
  } else {
    status = "OPEN";
    remainingSeconds = secondsBetween(
      closesAt && closesAt < input.scheduledAt
        ? closesAt
        : input.scheduledAt,
      now,
    );
  }

  return {
    status,
    message: attendanceWindowMessages[status],
    canRespond: status === "OPEN",
    opensAt: opensAt?.toISOString() ?? null,
    closesAt: closesAt?.toISOString() ?? null,
    remainingSeconds,
  };
}

export function isDriverAttendanceStatus(
  value: unknown,
): value is AttendanceStatus.Registered | AttendanceStatus.Declined {
  return (
    value === AttendanceStatus.Registered ||
    value === AttendanceStatus.Declined
  );
}
