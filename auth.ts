import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { z } from "zod";
import { canonicalPrismaAdapter } from "@/lib/auth/adapter";
import { authLogger } from "@/lib/auth/logging";
import { safeAuthErrorDetails } from "@/lib/auth/logging-details";
import { getPrismaClient } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";

const discordProfileSchema = z.object({
  id: z.string(),
  username: z.string().max(64),
  global_name: z.string().max(160).nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: canonicalPrismaAdapter(),
  logger: authLogger,
  providers: [Discord],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "discord") return true;
      const parsedProfile = discordProfileSchema.safeParse(profile);
      const userId = Number(user.id);
      if (!parsedProfile.success || !Number.isInteger(userId)) return true;

      try {
        const discordProfile = parsedProfile.data;
        await getPrismaClient().user.update({
          where: { id: userId },
          data: {
            discordId: discordProfile.id,
            discordUsername: discordProfile.username,
            discordGlobalName: discordProfile.global_name ?? null,
            discordAvatarUrl: discordProfile.avatar
              ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`
              : null,
            discordVerifiedAt: new Date(),
          },
        });
      } catch (error: unknown) {
        logger.warn("Discord OAuth profile synchronization failed", {
          userId,
          ...safeAuthErrorDetails(error),
          failedPhase: "discord_profile_persistence",
        });
      }
      return true;
    },
    session({ session, user }) {
      session.user = {
        ...session.user,
        id: user.id,
        canonicalUserId: Number(user.id),
        name: user.displayName,
        image: user.image,
        displayName: user.displayName,
        roles: user.roles,
        active: user.active,
      };

      return session;
    },
  },
});
