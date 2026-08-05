import "server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";
import {
  MOBILE_AUTHORIZATION_CODE_TTL_MS,
  MOBILE_OAUTH_ATTEMPT_TTL_MS,
  MOBILE_REDIRECT_URI,
} from "./constants";
import {
  discordAuthorizationUrl,
  discordAvatarUrl,
  exchangeDiscordCode,
} from "./discord";
import { forbidden, invalidRequest } from "./errors";
import { assertMobileUserEligible, discordAccountLookup } from "./mobile-user";
import {
  anonymizeMobileIdentifier,
  hashOpaqueToken,
  randomOpaqueToken,
} from "./secrets";

type OAuthAttemptInput = {
  redirectUri: typeof MOBILE_REDIRECT_URI;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  clientState: string;
};

export async function createMobileOAuthAttempt(
  input: OAuthAttemptInput,
  now = new Date(),
): Promise<{ authorizationUrl: URL }> {
  const oauthState = randomOpaqueToken();
  const authorizationUrl = discordAuthorizationUrl(oauthState);
  await getPrismaClient().mobileOAuthAttempt.create({
    data: {
      oauthStateHash: hashOpaqueToken(oauthState),
      clientState: input.clientState,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      redirectUri: input.redirectUri,
      expiresAt: new Date(now.getTime() + MOBILE_OAUTH_ATTEMPT_TTL_MS),
    },
  });
  return { authorizationUrl };
}

export function isMobileOAuthAttemptUsable(
  attempt: { expiresAt: Date; completedAt: Date | null },
  now = new Date(),
): boolean {
  return attempt.expiresAt > now && attempt.completedAt === null;
}

export async function claimMobileOAuthAttempt(
  oauthState: string,
  now = new Date(),
) {
  const prisma = getPrismaClient();
  const oauthStateHash = hashOpaqueToken(oauthState);
  const attempt = await prisma.mobileOAuthAttempt.findUnique({
    where: { oauthStateHash },
  });
  if (!attempt || !isMobileOAuthAttemptUsable(attempt, now)) {
    throw invalidRequest(
      "OAUTH_ATTEMPT_INVALID",
      "Der Anmeldeversuch ist abgelaufen oder wurde bereits verwendet.",
    );
  }
  const claimed = await prisma.mobileOAuthAttempt.updateMany({
    where: {
      id: attempt.id,
      completedAt: null,
      expiresAt: { gt: now },
    },
    data: { completedAt: now },
  });
  if (claimed.count !== 1) {
    throw invalidRequest(
      "OAUTH_ATTEMPT_INVALID",
      "Der Anmeldeversuch ist abgelaufen oder wurde bereits verwendet.",
    );
  }
  return { ...attempt, completedAt: now };
}

export type MobileOAuthCallbackResult = {
  redirectUri: string;
  clientState: string;
  authorizationCode?: string;
  error?: "LOGIN_FAILED";
};

export async function completeMobileDiscordOAuth(input: {
  oauthState: string;
  discordCode?: string;
  discordError?: string;
  now?: Date;
}): Promise<MobileOAuthCallbackResult> {
  const now = input.now ?? new Date();
  const attempt = await claimMobileOAuthAttempt(input.oauthState, now);
  const safeFailure = (): MobileOAuthCallbackResult => ({
    redirectUri: attempt.redirectUri,
    clientState: attempt.clientState,
    error: "LOGIN_FAILED",
  });
  if (input.discordError || !input.discordCode) return safeFailure();

  try {
    const identity = await exchangeDiscordCode(input.discordCode);
    const prisma = getPrismaClient();
    const account = await prisma.account.findUnique({
      where: discordAccountLookup(identity.id),
      include: { user: { include: { driver: true } } },
    });
    if (!account) throw forbidden();
    assertMobileUserEligible(account.user);

    const authorizationCode = randomOpaqueToken();
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: account.userId },
        data: {
          discordId: identity.id,
          discordUsername: identity.username,
          discordGlobalName: identity.global_name ?? null,
          discordAvatarUrl: discordAvatarUrl(identity),
          discordVerifiedAt: now,
        },
      });
      await transaction.mobileAuthorizationCode.create({
        data: {
          codeHash: hashOpaqueToken(authorizationCode),
          userId: account.userId,
          oauthAttemptId: attempt.id,
          expiresAt: new Date(now.getTime() + MOBILE_AUTHORIZATION_CODE_TTL_MS),
        },
      });
    });
    logger.info("Mobile Discord OAuth completed", {
      phase: "discord_callback",
      resultStatus: "success",
      attemptRef: anonymizeMobileIdentifier(attempt.id),
    });
    return {
      redirectUri: attempt.redirectUri,
      clientState: attempt.clientState,
      authorizationCode,
    };
  } catch (error: unknown) {
    logger.warn("Mobile Discord OAuth rejected", {
      phase: "discord_callback",
      resultStatus: "failure",
      errorClass: error instanceof Error ? error.name : "UnknownError",
      attemptRef: anonymizeMobileIdentifier(attempt.id),
    });
    return safeFailure();
  }
}

export function mobileOAuthCallbackRedirect(
  result: MobileOAuthCallbackResult,
): URL {
  if (result.redirectUri !== MOBILE_REDIRECT_URI) {
    throw new Error("UNSAFE_MOBILE_REDIRECT_URI");
  }
  const url = new URL(MOBILE_REDIRECT_URI);
  url.searchParams.set("state", result.clientState);
  if (result.authorizationCode) {
    url.searchParams.set("code", result.authorizationCode);
  } else {
    url.searchParams.set("error", "LOGIN_FAILED");
  }
  return url;
}
