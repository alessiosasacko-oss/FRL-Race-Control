const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

export function zonedLocalToUtc(
  localDateTime: string,
  timezone: string,
): Date {
  const match = localDateTime.match(localDateTimePattern);

  if (!match) {
    throw new Error("INVALID_LOCAL_DATE");
  }

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const desiredTimestamp = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  let timestamp = desiredTimestamp;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = zonedParts(new Date(timestamp), timezone);
    const observedTimestamp = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
    );
    timestamp += desiredTimestamp - observedTimestamp;
  }

  const result = new Date(timestamp);
  const verified = zonedParts(result, timezone);

  if (
    verified.year !== desired.year ||
    verified.month !== desired.month ||
    verified.day !== desired.day ||
    verified.hour !== desired.hour ||
    verified.minute !== desired.minute
  ) {
    throw new Error("INVALID_LOCAL_DATE");
  }

  return result;
}

export function formatLocalDateTimeInput(
  date: Date,
  timezone: string,
): string {
  const parts = zonedParts(date, timezone);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
