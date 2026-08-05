import "server-only";

import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/lib/db/prisma";
import { writeSystemAudit } from "@/lib/audit/system";
import {
  MOBILE_REFRESH_TOKEN_TTL_MS,
} from "./constants";
import { invalidRequest, unauthorized } from "./errors";
import {
  assertMobileUserEligible,
  issueMobileAccessToken,
  type MobileUserContext,
} from "./mobile-user";
import { verifyCodeChallenge } from "./pkce";
import { createRefreshToken, hashRefreshToken } from "./refresh-token";
import {
  anonymizeMobileIdentifier,
  getMobileAuthSecret,
  hashOpaqueToken,
} from "./secrets";
import { mobileAuthMeta } from "./response";

export type MobileTokenResponse = {
  data: {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
    sessionId: string;
  };
  meta: { apiVersion: "v1"; generatedAt: string };
};

function tokenResponse(input: {
  userId: number;
  sessionId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  now: Date;
}): MobileTokenResponse {
  const access = issueMobileAccessToken(
    { userId: input.userId, sessionId: input.sessionId },
    { now: input.now },
  );
  return {
    data: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: input.refreshToken,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt.toISOString(),
      sessionId: input.sessionId,
    },
    meta: mobileAuthMeta(input.now),
  };
}

export function isMobileAuthorizationCodeUsable(
  authorizationCode: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
): boolean {
  return authorizationCode.expiresAt > now && authorizationCode.usedAt === null;
}

export function classifyMobileRefreshToken(
  storedToken: {
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
    session: { expiresAt: Date; revokedAt: Date | null };
  },
  now = new Date(),
): "valid" | "reuse" | "invalid" {
  if (storedToken.usedAt) return "reuse";
  if (
    storedToken.revokedAt ||
    storedToken.expiresAt <= now ||
    storedToken.session.expiresAt <= now ||
    storedToken.session.revokedAt
  ) {
    return "invalid";
  }
  return "valid";
}

export async function exchangeMobileAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  platform?: "ios" | "android";
  deviceName?: string;
  appVersion?: string;
  now?: Date;
}): Promise<MobileTokenResponse> {
  const now = input.now ?? new Date();
  getMobileAuthSecret();
  const prisma = getPrismaClient();
  const authorizationCode = await prisma.mobileAuthorizationCode.findUnique({
    where: { codeHash: hashOpaqueToken(input.code) },
    include: {
      oauthAttempt: true,
      user: { include: { driver: true } },
    },
  });
  if (
    !authorizationCode ||
    !isMobileAuthorizationCodeUsable(authorizationCode, now)
  ) {
    throw unauthorized(
      "AUTHORIZATION_CODE_INVALID",
      "Der Autorisierungscode ist ungültig oder abgelaufen.",
    );
  }
  if (
    authorizationCode.oauthAttempt.codeChallengeMethod !== "S256" ||
    !verifyCodeChallenge(
      input.codeVerifier,
      authorizationCode.oauthAttempt.codeChallenge,
    )
  ) {
    throw unauthorized("PKCE_VERIFICATION_FAILED", "Die PKCE-Prüfung ist fehlgeschlagen.");
  }
  assertMobileUserEligible(authorizationCode.user);

  const refresh = createRefreshToken();
  const refreshTokenExpiresAt = new Date(
    now.getTime() + MOBILE_REFRESH_TOKEN_TTL_MS,
  );
  const session = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.mobileAuthorizationCode.updateMany({
      where: {
        id: authorizationCode.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw unauthorized(
        "AUTHORIZATION_CODE_INVALID",
        "Der Autorisierungscode ist ungültig oder wurde bereits verwendet.",
      );
    }
    const created = await transaction.mobileSession.create({
      data: {
        userId: authorizationCode.userId,
        tokenFamilyId: randomUUID(),
        platform: input.platform,
        deviceName: input.deviceName,
        appVersion: input.appVersion,
        expiresAt: refreshTokenExpiresAt,
        lastUsedAt: now,
        refreshTokens: {
          create: {
            tokenHash: refresh.hash,
            expiresAt: refreshTokenExpiresAt,
          },
        },
      },
    });
    await writeSystemAudit(transaction, {
      actorId: authorizationCode.userId,
      action: "MOBILE_SESSION_CREATED",
      entityType: "MobileSession",
      metadata: {
        sessionRef: anonymizeMobileIdentifier(created.id),
        platform: input.platform ?? "unknown",
      },
    });
    return created;
  });
  return tokenResponse({
    userId: authorizationCode.userId,
    sessionId: session.id,
    refreshToken: refresh.value,
    refreshTokenExpiresAt,
    now,
  });
}

async function revokeRefreshFamily(input: {
  sessionId: string;
  tokenFamilyId: string;
  userId: number;
  now: Date;
}): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$transaction(async (transaction) => {
    await transaction.mobileSession.updateMany({
      where: { tokenFamilyId: input.tokenFamilyId },
      data: { revokedAt: input.now },
    });
    await transaction.mobileRefreshToken.updateMany({
      where: { sessionId: input.sessionId, revokedAt: null },
      data: { revokedAt: input.now },
    });
    await writeSystemAudit(transaction, {
      actorId: input.userId,
      action: "MOBILE_REFRESH_TOKEN_REUSE",
      entityType: "MobileSession",
      metadata: { sessionRef: anonymizeMobileIdentifier(input.sessionId) },
    });
  });
}

export async function rotateMobileRefreshToken(input: {
  refreshToken: string;
  now?: Date;
}): Promise<MobileTokenResponse> {
  const now = input.now ?? new Date();
  getMobileAuthSecret();
  const prisma = getPrismaClient();
  const storedToken = await prisma.mobileRefreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(input.refreshToken) },
    include: { session: { include: { user: { include: { driver: true } } } } },
  });
  if (!storedToken) throw unauthorized("REFRESH_TOKEN_INVALID");
  const refreshStatus = classifyMobileRefreshToken(storedToken, now);
  if (refreshStatus === "reuse") {
    await revokeRefreshFamily({
      sessionId: storedToken.sessionId,
      tokenFamilyId: storedToken.session.tokenFamilyId,
      userId: storedToken.session.userId,
      now,
    });
    throw unauthorized(
      "REFRESH_TOKEN_REUSED",
      "Die Sitzung wurde aus Sicherheitsgründen widerrufen.",
    );
  }
  if (refreshStatus === "invalid") {
    throw unauthorized("REFRESH_TOKEN_INVALID");
  }
  assertMobileUserEligible(storedToken.session.user);

  const replacement = createRefreshToken();
  const rotated = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.mobileRefreshToken.updateMany({
      where: {
        id: storedToken.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) return false;
    const activeSession = await transaction.mobileSession.updateMany({
      where: {
        id: storedToken.sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { lastUsedAt: now },
    });
    if (activeSession.count !== 1) {
      throw unauthorized("REFRESH_TOKEN_INVALID");
    }
    await transaction.mobileRefreshToken.create({
      data: {
        sessionId: storedToken.sessionId,
        tokenHash: replacement.hash,
        expiresAt: storedToken.session.expiresAt,
      },
    });
    return true;
  });
  if (!rotated) {
    await revokeRefreshFamily({
      sessionId: storedToken.sessionId,
      tokenFamilyId: storedToken.session.tokenFamilyId,
      userId: storedToken.session.userId,
      now,
    });
    throw unauthorized(
      "REFRESH_TOKEN_REUSED",
      "Die Sitzung wurde aus Sicherheitsgründen widerrufen.",
    );
  }
  return tokenResponse({
    userId: storedToken.session.userId,
    sessionId: storedToken.sessionId,
    refreshToken: replacement.value,
    refreshTokenExpiresAt: storedToken.session.expiresAt,
    now,
  });
}

export async function revokeMobileSession(
  context: MobileUserContext,
  now = new Date(),
) {
  if (context.session.id !== context.claims.sid) {
    throw invalidRequest("MOBILE_SESSION_MISMATCH");
  }
  const prisma = getPrismaClient();
  await prisma.$transaction(async (transaction) => {
    const revoked = await transaction.mobileSession.updateMany({
      where: { id: context.session.id, revokedAt: null },
      data: { revokedAt: now, lastUsedAt: now },
    });
    await transaction.mobileRefreshToken.updateMany({
      where: { sessionId: context.session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (revoked.count === 1) {
      await writeSystemAudit(transaction, {
        actorId: context.user.id,
        action: "MOBILE_SESSION_LOGOUT",
        entityType: "MobileSession",
        metadata: {
          sessionRef: anonymizeMobileIdentifier(context.session.id),
        },
      });
    }
  });
  return {
    data: { loggedOut: true, sessionId: context.session.id },
    meta: mobileAuthMeta(now),
  };
}
