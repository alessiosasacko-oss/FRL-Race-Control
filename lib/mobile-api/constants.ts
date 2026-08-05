export const MOBILE_API_VERSION = "v1" as const;
export const MOBILE_API_SERVICE = "frl-mobile-api" as const;
export const MOBILE_API_DEFAULT_LEAGUE = "F1" as const;

export const MOBILE_API_FEATURES = Object.freeze({
  calendar: true,
  results: true,
  driverChampionship: true,
  teamChampionship: true,
  authentication: true,
  attendance: true,
  fia: false,
});

export const MOBILE_API_RATE_LIMIT = Object.freeze({
  limit: 120,
  windowMs: 60_000,
});

export const MOBILE_ATTENDANCE_RATE_LIMITS = Object.freeze({
  read: { limit: 60, windowMs: 60_000 },
  write: { limit: 20, windowMs: 10 * 60_000 },
});

export const MOBILE_API_CACHE_SECONDS = Object.freeze({
  bootstrap: 60,
  leagues: 60,
  calendar: 30,
  championship: 30,
  results: 60,
});
