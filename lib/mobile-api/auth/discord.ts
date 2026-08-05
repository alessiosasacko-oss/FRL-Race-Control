import "server-only";

import { z } from "zod";
import { MOBILE_DISCORD_CALLBACK_URI } from "./constants";

const discordTokenSchema = z.object({
  access_token: z.string().min(1).max(4_096),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
});

const discordIdentitySchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1).max(64),
  global_name: z.string().max(160).nullable().optional(),
  avatar: z.string().max(255).nullable().optional(),
});

export type DiscordMobileIdentity = z.infer<typeof discordIdentitySchema>;

export class DiscordMobileOAuthError extends Error {
  constructor(public readonly phase: "token_exchange" | "identity_fetch") {
    super("DISCORD_MOBILE_OAUTH_FAILED");
    this.name = "DiscordMobileOAuthError";
  }
}

function discordCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.AUTH_DISCORD_ID;
  const clientSecret = process.env.AUTH_DISCORD_SECRET;
  if (!clientId || !clientSecret) throw new Error("DISCORD_OAUTH_CONFIG_MISSING");
  return { clientId, clientSecret };
}

export function discordAuthorizationUrl(oauthState: string): URL {
  const { clientId } = discordCredentials();
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", MOBILE_DISCORD_CALLBACK_URI);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", oauthState);
  return url;
}

export async function exchangeDiscordCode(
  authorizationCode: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<DiscordMobileIdentity> {
  const { clientId, clientSecret } = discordCredentials();
  const tokenResponse = await fetchImplementation(
    "https://discord.com/api/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: authorizationCode,
        redirect_uri: MOBILE_DISCORD_CALLBACK_URI,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => {
    throw new DiscordMobileOAuthError("token_exchange");
  });
  if (!tokenResponse.ok) {
    throw new DiscordMobileOAuthError("token_exchange");
  }
  const parsedToken = discordTokenSchema.safeParse(
    await tokenResponse.json().catch(() => null),
  );
  if (!parsedToken.success) {
    throw new DiscordMobileOAuthError("token_exchange");
  }

  const identityResponse = await fetchImplementation(
    "https://discord.com/api/users/@me",
    {
      headers: {
        Authorization: `${parsedToken.data.token_type} ${parsedToken.data.access_token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => {
    throw new DiscordMobileOAuthError("identity_fetch");
  });
  if (!identityResponse.ok) {
    throw new DiscordMobileOAuthError("identity_fetch");
  }
  const identity = discordIdentitySchema.safeParse(
    await identityResponse.json().catch(() => null),
  );
  if (!identity.success) {
    throw new DiscordMobileOAuthError("identity_fetch");
  }
  return identity.data;
}

export function discordAvatarUrl(identity: DiscordMobileIdentity): string | null {
  return identity.avatar
    ? `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png?size=256`
    : null;
}
