export const MOBILE_REDIRECT_URI =
  "frlracecontrol://auth/callback" as const;
export const MOBILE_DISCORD_CALLBACK_URI =
  "https://frl-race-control.vercel.app/api/mobile/v1/auth/discord/callback" as const;

export const MOBILE_ACCESS_TOKEN_ISSUER =
  "https://frl-race-control.vercel.app" as const;
export const MOBILE_ACCESS_TOKEN_AUDIENCE =
  "frl-race-control-mobile-v1" as const;

export const MOBILE_OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1_000;
export const MOBILE_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1_000;
export const MOBILE_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const MOBILE_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export const MOBILE_AUTH_RATE_LIMITS = Object.freeze({
  start: { limit: 20, windowMs: 10 * 60 * 1_000 },
  callback: { limit: 30, windowMs: 10 * 60 * 1_000 },
  exchange: { limit: 20, windowMs: 10 * 60 * 1_000 },
  refresh: { limit: 60, windowMs: 60 * 60 * 1_000 },
  logout: { limit: 120, windowMs: 60 * 1_000 },
  me: { limit: 120, windowMs: 60 * 1_000 },
});
