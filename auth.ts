import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { canonicalPrismaAdapter } from "@/lib/auth/adapter";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: canonicalPrismaAdapter(),
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
