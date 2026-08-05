import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { Role } from "@/domain";
import {
  issueMobileAccessToken,
  verifyMobileAccessToken,
} from "./access-token";
import { readBearerToken } from "./bearer-token";
import {
  MOBILE_ACCESS_TOKEN_AUDIENCE,
  MOBILE_ACCESS_TOKEN_ISSUER,
  MOBILE_REDIRECT_URI,
} from "./constants";
import {
  discordAuthorizationUrl,
  exchangeDiscordCode,
} from "./discord";
import { MobileAuthError } from "./errors";
import { mobileAuthCleanupCutoffs } from "./cleanup";
import {
  classifyMobileRefreshToken,
  isMobileAuthorizationCodeUsable,
} from "./mobile-session";
import {
  assertMobileUserEligible,
  discordAccountLookup,
  serializeMobileUser,
  type MobileUserContext,
} from "./mobile-user";
import {
  isMobileOAuthAttemptUsable,
  mobileOAuthCallbackRedirect,
} from "./oauth-attempt";
import {
  deriveCodeChallenge,
  isValidCodeChallenge,
  isValidCodeVerifier,
  verifyCodeChallenge,
} from "./pkce";
import { createRefreshToken, hashRefreshToken } from "./refresh-token";
import { handleMobileAuthRequest } from "./response";
import {
  mobileAuthExchangeSchema,
  mobileAuthCallbackSchema,
  mobileAuthStartSchema,
} from "./schemas";
import {
  getMobileAuthSecret,
  hashOpaqueToken,
  randomOpaqueToken,
} from "./secrets";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const TEST_SECRET = "0123456789abcdef0123456789abcdef";
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

function validStart(overrides: Record<string, unknown> = {}) {
  return {
    redirectUri: MOBILE_REDIRECT_URI,
    codeChallenge: RFC_CHALLENGE,
    codeChallengeMethod: "S256",
    clientState: "client-state-1234567890",
    ...overrides,
  };
}

function customJwt(claimOverrides: Record<string, unknown>): string {
  const iat = Math.floor(NOW.getTime() / 1_000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: MOBILE_ACCESS_TOKEN_ISSUER,
      aud: MOBILE_ACCESS_TOKEN_AUDIENCE,
      sub: "7",
      sid: "session-7",
      iat,
      exp: iat + 900,
      jti: "4b8cf360-e55a-40f7-9c69-07d2ec0c5d80",
      ...claimOverrides,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const signature = createHmac("sha256", TEST_SECRET)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

function assertAuthError(operation: () => unknown, code: string): void {
  assert.throws(operation, (error: unknown) => {
    return error instanceof MobileAuthError && error.code === code;
  });
}

test("auth start accepts only the configured native redirect URI", () => {
  assert.equal(mobileAuthStartSchema.safeParse(validStart()).success, true);
});

test("auth start rejects a foreign HTTPS redirect URI", () => {
  assert.equal(
    mobileAuthStartSchema.safeParse(
      validStart({ redirectUri: "https://evil.example/callback" }),
    ).success,
    false,
  );
});

test("auth start rejects a javascript redirect URI", () => {
  assert.equal(
    mobileAuthStartSchema.safeParse(
      validStart({ redirectUri: "javascript:alert(1)" }),
    ).success,
    false,
  );
});

test("PKCE requires the S256 method", () => {
  assert.equal(
    mobileAuthStartSchema.safeParse(
      validStart({ codeChallengeMethod: "plain" }),
    ).success,
    false,
  );
});

test("invalid PKCE challenges are rejected", () => {
  assert.equal(isValidCodeChallenge("short"), false);
  assert.equal(
    mobileAuthStartSchema.safeParse(validStart({ codeChallenge: "short" }))
      .success,
    false,
  );
});

test("PKCE S256 follows the RFC 7636 vector", () => {
  assert.equal(isValidCodeVerifier(RFC_VERIFIER), true);
  assert.equal(deriveCodeChallenge(RFC_VERIFIER), RFC_CHALLENGE);
  assert.equal(verifyCodeChallenge(RFC_VERIFIER, RFC_CHALLENGE), true);
});

test("a wrong PKCE verifier is rejected", () => {
  const wrong = "A".repeat(43);
  assert.equal(verifyCodeChallenge(wrong, RFC_CHALLENGE), false);
  assert.equal(
    mobileAuthExchangeSchema.safeParse({
      code: randomOpaqueToken(),
      codeVerifier: "short",
    }).success,
    false,
  );
});

test("OAuth state is cryptographically random and represented by a hash", () => {
  const state = randomOpaqueToken();
  const hash = hashOpaqueToken(state);
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, state);
});

test("an expired OAuth attempt is unusable", () => {
  assert.equal(
    isMobileOAuthAttemptUsable(
      { expiresAt: new Date(NOW.getTime() - 1), completedAt: null },
      NOW,
    ),
    false,
  );
});

test("a completed OAuth attempt is unusable", () => {
  assert.equal(
    isMobileOAuthAttemptUsable(
      { expiresAt: new Date(NOW.getTime() + 1_000), completedAt: NOW },
      NOW,
    ),
    false,
  );
});

test("a standard Discord denial callback is accepted without exposing its description", () => {
  assert.equal(
    mobileAuthCallbackSchema.safeParse({
      state: "A".repeat(43),
      error: "access_denied",
      error_description: "The resource owner denied the request",
    }).success,
    true,
  );
});

test("Discord identity lookup uses providerAccountId", () => {
  assert.deepEqual(discordAccountLookup("12345678901234567"), {
    provider_providerAccountId: {
      provider: "discord",
      providerAccountId: "12345678901234567",
    },
  });
});

test("Discord display names never participate in identity lookup", () => {
  assert.doesNotMatch(JSON.stringify(discordAccountLookup("123")), /username|name/i);
});

test("an active canonical user with a role is eligible", () => {
  assert.doesNotThrow(() =>
    assertMobileUserEligible({
      active: true,
      lockedAt: null,
      roles: [Role.Driver],
      driver: { active: true },
    }),
  );
});

test("a deactivated user is rejected", () => {
  assertAuthError(
    () =>
      assertMobileUserEligible({
        active: false,
        lockedAt: null,
        roles: [Role.Driver],
      }),
    "ACCOUNT_NOT_ALLOWED",
  );
});

test("a locked user is rejected", () => {
  assertAuthError(
    () =>
      assertMobileUserEligible({
        active: true,
        lockedAt: NOW,
        roles: [Role.Driver],
      }),
    "ACCOUNT_NOT_ALLOWED",
  );
});

test("a deactivated driver profile is rejected", () => {
  assertAuthError(
    () =>
      assertMobileUserEligible({
        active: true,
        lockedAt: null,
        roles: [Role.Driver],
        driver: { active: false },
      }),
    "ACCOUNT_NOT_ALLOWED",
  );
});

test("a roleless account fails the existing login release rule", () => {
  assertAuthError(
    () =>
      assertMobileUserEligible({ active: true, lockedAt: null, roles: [] }),
    "ACCOUNT_NOT_ALLOWED",
  );
});

test("an unused app authorization code is usable once", () => {
  assert.equal(
    isMobileAuthorizationCodeUsable(
      { expiresAt: new Date(NOW.getTime() + 1_000), usedAt: null },
      NOW,
    ),
    true,
  );
});

test("a consumed app authorization code cannot be reused", () => {
  assert.equal(
    isMobileAuthorizationCodeUsable(
      { expiresAt: new Date(NOW.getTime() + 1_000), usedAt: NOW },
      NOW,
    ),
    false,
  );
});

test("an expired app authorization code is rejected", () => {
  assert.equal(
    isMobileAuthorizationCodeUsable(
      { expiresAt: NOW, usedAt: null },
      NOW,
    ),
    false,
  );
});

test("app codes are stored as irreversible SHA-256 digests", () => {
  const code = randomOpaqueToken();
  const digest = hashOpaqueToken(code);
  assert.notEqual(code, digest);
  assert.equal(digest.length, 64);
});

test("access tokens contain only the required short-lived claims", () => {
  const result = issueMobileAccessToken(
    { userId: 7, sessionId: "session-7" },
    { now: NOW, secret: TEST_SECRET },
  );
  const claims = verifyMobileAccessToken(result.token, {
    now: NOW,
    secret: TEST_SECRET,
  });
  assert.deepEqual(Object.keys(claims).sort(), [
    "aud",
    "exp",
    "iat",
    "iss",
    "jti",
    "sid",
    "sub",
  ]);
  assert.equal(claims.exp - claims.iat, 15 * 60);
});

test("access tokens expire after fifteen minutes", () => {
  const result = issueMobileAccessToken(
    { userId: 7, sessionId: "session-7" },
    { now: NOW, secret: TEST_SECRET },
  );
  assertAuthError(
    () =>
      verifyMobileAccessToken(result.token, {
        now: new Date(NOW.getTime() + 15 * 60 * 1_000),
        secret: TEST_SECRET,
      }),
    "ACCESS_TOKEN_INVALID",
  );
});

test("access tokens with a foreign issuer are rejected", () => {
  assertAuthError(
    () =>
      verifyMobileAccessToken(customJwt({ iss: "https://evil.example" }), {
        now: NOW,
        secret: TEST_SECRET,
      }),
    "ACCESS_TOKEN_INVALID",
  );
});

test("access tokens with a foreign audience are rejected", () => {
  assertAuthError(
    () =>
      verifyMobileAccessToken(customJwt({ aud: "another-app" }), {
        now: NOW,
        secret: TEST_SECRET,
      }),
    "ACCESS_TOKEN_INVALID",
  );
});

test("access tokens with an invalid signature are rejected", () => {
  const token = customJwt({});
  const invalid = `${token.slice(0, token.lastIndexOf(".") + 1)}AAAA`;
  assertAuthError(
    () =>
      verifyMobileAccessToken(invalid, { now: NOW, secret: TEST_SECRET }),
    "ACCESS_TOKEN_INVALID",
  );
});

test("Bearer authentication is mandatory and strict", () => {
  assertAuthError(
    () => readBearerToken(new Request("https://example.test")),
    "BEARER_TOKEN_REQUIRED",
  );
  assertAuthError(
    () =>
      readBearerToken(
        new Request("https://example.test", {
          headers: { Authorization: "Basic abc" },
        }),
      ),
    "BEARER_TOKEN_REQUIRED",
  );
});

test("refresh tokens are random and stored only as hashes", () => {
  const token = createRefreshToken();
  assert.match(token.value, /^[A-Za-z0-9_-]{43}$/);
  assert.match(token.hash, /^[a-f0-9]{64}$/);
  assert.equal(hashRefreshToken(token.value), token.hash);
  assert.notEqual(token.value, token.hash);
});

test("a current refresh token is valid", () => {
  assert.equal(
    classifyMobileRefreshToken(
      {
        expiresAt: new Date(NOW.getTime() + 1_000),
        usedAt: null,
        revokedAt: null,
        session: {
          expiresAt: new Date(NOW.getTime() + 1_000),
          revokedAt: null,
        },
      },
      NOW,
    ),
    "valid",
  );
});

test("a rotated refresh token is classified as reuse", () => {
  assert.equal(
    classifyMobileRefreshToken(
      {
        expiresAt: new Date(NOW.getTime() + 1_000),
        usedAt: NOW,
        revokedAt: null,
        session: {
          expiresAt: new Date(NOW.getTime() + 1_000),
          revokedAt: null,
        },
      },
      NOW,
    ),
    "reuse",
  );
});

test("a revoked refresh token is invalid", () => {
  assert.equal(
    classifyMobileRefreshToken(
      {
        expiresAt: new Date(NOW.getTime() + 1_000),
        usedAt: null,
        revokedAt: NOW,
        session: {
          expiresAt: new Date(NOW.getTime() + 1_000),
          revokedAt: null,
        },
      },
      NOW,
    ),
    "invalid",
  );
});

test("an expired or revoked refresh session is invalid", () => {
  assert.equal(
    classifyMobileRefreshToken(
      {
        expiresAt: new Date(NOW.getTime() + 1_000),
        usedAt: null,
        revokedAt: null,
        session: { expiresAt: NOW, revokedAt: null },
      },
      NOW,
    ),
    "invalid",
  );
});

function mobileUserContext(): MobileUserContext {
  return {
    claims: {
      iss: MOBILE_ACCESS_TOKEN_ISSUER,
      aud: MOBILE_ACCESS_TOKEN_AUDIENCE,
      sub: "7",
      sid: "session-7",
      iat: 1,
      exp: 2,
      jti: "4b8cf360-e55a-40f7-9c69-07d2ec0c5d80",
    },
    session: {
      id: "session-7",
      userId: 7,
      tokenFamilyId: "47c11cb3-e778-4c6f-b856-1f7c0f640ef5",
      expiresAt: new Date(NOW.getTime() + 1_000),
      lastUsedAt: NOW,
      revokedAt: null,
    },
    user: {
      id: 7,
      displayName: "Fallback Name",
      discordUsername: "discord-user",
      discordGlobalName: "Discord Driver",
      discordAvatarUrl: "https://cdn.discordapp.com/avatar.png",
      avatarUrl: null,
      roles: [Role.Driver, Role.Steward],
      active: true,
      lockedAt: null,
      driver: {
        id: 10,
        name: "Race Driver",
        number: 27,
        flag: "DE",
        countryCode: "DE",
        active: true,
        league: { code: "F1", name: "Formula 1" },
        team: { name: "Legacy Team", logoUrl: null },
        seasonAssignments: [
          {
            league: { code: "F2", name: "Formula 2" },
            organization: {
              name: "Current Team",
              logoUrl: "https://cdn.example/team.png",
            },
          },
        ],
      },
    },
  };
}

test("me returns roles and permissions loaded from the database context", () => {
  const result = serializeMobileUser(mobileUserContext());
  assert.deepEqual(result.roles, [Role.Driver, Role.Steward]);
  assert.ok(result.permissions.includes("VIEW_RACE_CONTROL"));
  assert.ok(result.permissions.includes("REVIEW_FIA_TICKET"));
});

test("me returns the current database league and team assignment", () => {
  const result = serializeMobileUser(mobileUserContext());
  assert.equal(result.league?.code, "F2");
  assert.equal(result.team?.name, "Current Team");
  assert.equal(result.team?.logoUrl, "https://cdn.example/team.png");
});

test("me never contains email addresses or authentication secrets", () => {
  const result = JSON.stringify(serializeMobileUser(mobileUserContext()));
  assert.doesNotMatch(
    result,
    /email|accessToken|refreshToken|sessionToken|clientSecret|botToken/i,
  );
});

test("successful OAuth redirects return only app code and client state", () => {
  const url = mobileOAuthCallbackRedirect({
    redirectUri: MOBILE_REDIRECT_URI,
    clientState: "client-state-1234567890",
    authorizationCode: "A".repeat(43),
  });
  assert.equal(`${url.protocol}//${url.host}${url.pathname}`, MOBILE_REDIRECT_URI);
  assert.equal(url.searchParams.get("state"), "client-state-1234567890");
  assert.equal(url.searchParams.get("code"), "A".repeat(43));
  assert.equal(url.searchParams.has("error"), false);
});

test("OAuth failures redirect with only LOGIN_FAILED and client state", () => {
  const url = mobileOAuthCallbackRedirect({
    redirectUri: MOBILE_REDIRECT_URI,
    clientState: "client-state-1234567890",
    error: "LOGIN_FAILED",
  });
  assert.equal(url.searchParams.get("error"), "LOGIN_FAILED");
  assert.equal(url.searchParams.get("state"), "client-state-1234567890");
  assert.equal(url.searchParams.has("code"), false);
});

test("Discord authorization requests only the identify scope", () => {
  const previousId = process.env.AUTH_DISCORD_ID;
  const previousSecret = process.env.AUTH_DISCORD_SECRET;
  process.env.AUTH_DISCORD_ID = "discord-client-id";
  process.env.AUTH_DISCORD_SECRET = "discord-client-secret";
  try {
    const url = discordAuthorizationUrl("A".repeat(43));
    assert.equal(url.searchParams.get("scope"), "identify");
    assert.equal(url.searchParams.get("state"), "A".repeat(43));
    assert.equal(url.searchParams.has("client_secret"), false);
  } finally {
    if (previousId === undefined) delete process.env.AUTH_DISCORD_ID;
    else process.env.AUTH_DISCORD_ID = previousId;
    if (previousSecret === undefined) delete process.env.AUTH_DISCORD_SECRET;
    else process.env.AUTH_DISCORD_SECRET = previousSecret;
  }
});

test("Discord access tokens stay inside the server-side exchange", async () => {
  const previousId = process.env.AUTH_DISCORD_ID;
  const previousSecret = process.env.AUTH_DISCORD_SECRET;
  process.env.AUTH_DISCORD_ID = "discord-client-id";
  process.env.AUTH_DISCORD_SECRET = "discord-client-secret";
  const requests: Array<{ url: string; authorization?: string }> = [];
  const fakeFetch = (async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ) => {
    const url = String(input);
    requests.push({
      url,
      authorization: new Headers(init?.headers).get("authorization") ?? undefined,
    });
    if (url.endsWith("/oauth2/token")) {
      return Response.json({
        access_token: "discord-access-secret",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "identify",
      });
    }
    return Response.json({
      id: "12345678901234567",
      username: "driver",
      global_name: "Race Driver",
      avatar: null,
    });
  }) as typeof fetch;
  try {
    const identity = await exchangeDiscordCode("discord-code", fakeFetch);
    assert.equal(identity.id, "12345678901234567");
    assert.doesNotMatch(JSON.stringify(identity), /discord-access-secret/);
    assert.equal(requests[1]?.authorization, "Bearer discord-access-secret");
  } finally {
    if (previousId === undefined) delete process.env.AUTH_DISCORD_ID;
    else process.env.AUTH_DISCORD_ID = previousId;
    if (previousSecret === undefined) delete process.env.AUTH_DISCORD_SECRET;
    else process.env.AUTH_DISCORD_SECRET = previousSecret;
  }
});

test("mobile auth rate limiting returns HTTP 429", async () => {
  const request = new Request("https://example.test/api/mobile/v1/auth/exchange", {
    headers: { "x-forwarded-for": "mobile-auth-rate-limit-test" },
  });
  const limit = { limit: 1, windowMs: 60_000 };
  assert.equal(
    (await handleMobileAuthRequest(request, "rate-limit-test", limit, async () => ({})))
      .status,
    200,
  );
  const response = await handleMobileAuthRequest(
    request,
    "rate-limit-test",
    limit,
    async () => ({}),
  );
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "RATE_LIMITED");
});

test("unexpected mobile auth errors never expose stack traces", async () => {
  const original = console.error;
  console.error = () => undefined;
  try {
    const response = await handleMobileAuthRequest(
      new Request("https://example.test", {
        headers: { "x-forwarded-for": "mobile-auth-error-test" },
      }),
      "safe-error-test",
      { limit: 2, windowMs: 60_000 },
      async () => {
        throw new Error("private internal detail");
      },
    );
    const body = JSON.stringify(await response.json());
    assert.equal(response.status, 500);
    assert.doesNotMatch(body, /stack|private internal detail/i);
  } finally {
    console.error = original;
  }
});

test("token values are never included in structured logs", async () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (...values: unknown[]) => lines.push(values.join(" "));
  try {
    await handleMobileAuthRequest(
      new Request("https://example.test", {
        headers: { "x-forwarded-for": "mobile-auth-log-test" },
      }),
      "log-safety-test",
      { limit: 2, windowMs: 60_000 },
      async () => ({ accessToken: "never-log-this-token" }),
    );
    assert.doesNotMatch(lines.join("\n"), /never-log-this-token/);
  } finally {
    console.info = original;
  }
});

test("cleanup cutoffs bound expired OAuth and session records", () => {
  const cutoffs = mobileAuthCleanupCutoffs(NOW);
  assert.equal(
    NOW.getTime() - cutoffs.completedBefore.getTime(),
    24 * 60 * 60 * 1_000,
  );
  assert.equal(
    NOW.getTime() - cutoffs.sessionBefore.getTime(),
    30 * 24 * 60 * 60 * 1_000,
  );
});

test("MOBILE_AUTH_SECRET requires at least 32 bytes", () => {
  assert.throws(() => getMobileAuthSecret("too-short"), /MOBILE_AUTH_SECRET_INVALID/);
  assert.equal(getMobileAuthSecret(TEST_SECRET).length, 32);
});

test("the existing Auth.js Discord web login remains database-backed", () => {
  const source = readFileSync(join(process.cwd(), "auth.ts"), "utf8");
  assert.match(source, /providers:\s*\[Discord\]/);
  assert.match(source, /strategy:\s*"database"/);
  assert.match(source, /canonicalPrismaAdapter\(\)/);
  assert.doesNotMatch(source, /mobileAuthorizationCode|MobileSession/);
});

test("mobile callback and refresh implementation preserve security invariants", () => {
  const oauthSource = readFileSync(
    join(process.cwd(), "lib/mobile-api/auth/oauth-attempt.ts"),
    "utf8",
  );
  const sessionSource = readFileSync(
    join(process.cwd(), "lib/mobile-api/auth/mobile-session.ts"),
    "utf8",
  );
  const cleanupSource = readFileSync(
    join(process.cwd(), "lib/mobile-api/auth/cleanup.ts"),
    "utf8",
  );
  const userSource = readFileSync(
    join(process.cwd(), "lib/mobile-api/auth/mobile-user.ts"),
    "utf8",
  );
  assert.match(userSource, /providerAccountId/);
  assert.match(oauthSource, /codeHash:\s*hashOpaqueToken/);
  assert.doesNotMatch(oauthSource, /access_token|refresh_token/);
  assert.match(sessionSource, /usedAt:\s*now/);
  assert.match(sessionSource, /MOBILE_REFRESH_TOKEN_REUSE/);
  assert.match(sessionSource, /where:\s*\{ id: context\.session\.id, revokedAt: null \}/);
  assert.match(cleanupSource, /mobileOAuthAttempt\.deleteMany/);
  assert.match(cleanupSource, /mobileSession\.deleteMany/);
});
