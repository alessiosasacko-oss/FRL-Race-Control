import "server-only";
import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
} from "next-auth/adapters";
import type {
  Account as DatabaseAccount,
  Session as DatabaseSession,
  User as DatabaseUser,
} from "@/generated/prisma/client";
import { entityIdSchema, roleSchema, type Role } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";

export type CanonicalAdapterUser = AdapterUser & {
  displayName: string;
  roles: Role[];
  active: boolean;
};

function parseUserId(userId: string): number {
  const parsedUserId = entityIdSchema.safeParse(Number(userId));

  if (!parsedUserId.success) {
    throw new Error(`Invalid canonical user ID: ${userId}`);
  }

  return parsedUserId.data;
}

function toAdapterUser(user: DatabaseUser): CanonicalAdapterUser {
  if (!user.email) {
    throw new Error(`Canonical user ${user.id} has no authentication email.`);
  }

  return {
    id: String(user.id),
    name: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.avatarUrl,
    displayName: user.displayName,
    roles: roleSchema.array().parse(user.roles),
    active: user.active,
  };
}

function toAdapterAccount(account: DatabaseAccount): AdapterAccount {
  return {
    userId: String(account.userId),
    type: account.type as AdapterAccount["type"],
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    refresh_token: account.refresh_token ?? undefined,
    access_token: account.access_token ?? undefined,
    expires_at: account.expires_at ?? undefined,
    token_type:
      (account.token_type as AdapterAccount["token_type"]) ?? undefined,
    scope: account.scope ?? undefined,
    id_token: account.id_token ?? undefined,
    session_state: account.session_state ?? undefined,
  };
}

function toAdapterSession(session: DatabaseSession): AdapterSession {
  return {
    sessionToken: session.sessionToken,
    userId: String(session.userId),
    expires: session.expires,
  };
}

function accountData(account: AdapterAccount) {
  return {
    userId: parseUserId(account.userId),
    type: account.type,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    refresh_token: account.refresh_token ?? null,
    access_token: account.access_token ?? null,
    expires_at: account.expires_at ?? null,
    token_type: account.token_type ?? null,
    scope: account.scope ?? null,
    id_token: account.id_token ?? null,
    session_state:
      account.session_state === undefined
        ? null
        : String(account.session_state),
  };
}

export function canonicalPrismaAdapter(): Adapter {
  return {
    async createUser(user) {
      const prisma = getPrismaClient();
      const createdUser = await prisma.user.create({
        data: {
          email: user.email.toLowerCase(),
          emailVerified: user.emailVerified,
          displayName: user.name?.trim() || user.email,
          avatarUrl: user.image,
        },
      });

      return toAdapterUser(createdUser);
    },

    async getUser(id) {
      const user = await getPrismaClient().user.findUnique({
        where: { id: parseUserId(id) },
      });

      return user ? toAdapterUser(user) : null;
    },

    async getUserByEmail(email) {
      const user = await getPrismaClient().user.findUnique({
        where: { email: email.toLowerCase() },
      });

      return user ? toAdapterUser(user) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await getPrismaClient().account.findUnique({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
        include: { user: true },
      });

      return account ? toAdapterUser(account.user) : null;
    },

    async updateUser(user) {
      const updatedUser = await getPrismaClient().user.update({
        where: { id: parseUserId(user.id) },
        data: {
          ...(user.name === undefined || user.name === null
            ? {}
            : { displayName: user.name }),
          ...(user.email === undefined
            ? {}
            : { email: user.email.toLowerCase() }),
          ...(user.emailVerified === undefined
            ? {}
            : { emailVerified: user.emailVerified }),
          ...(user.image === undefined ? {} : { avatarUrl: user.image }),
        },
      });

      return toAdapterUser(updatedUser);
    },

    async deleteUser(userId) {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({
        where: { id: parseUserId(userId) },
      });

      if (!user) {
        return null;
      }

      await prisma.user.delete({ where: { id: user.id } });
      return toAdapterUser(user);
    },

    async linkAccount(account) {
      const prisma = getPrismaClient();
      const data = accountData(account);

      const storedAccount = await prisma.$transaction(async (transaction) => {
        const linkedAccount = await transaction.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: data,
          create: data,
        });

        if (account.provider === "discord") {
          await transaction.user.update({
            where: { id: data.userId },
            data: { discordId: account.providerAccountId },
          });
        }

        return linkedAccount;
      });

      return toAdapterAccount(storedAccount);
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const prisma = getPrismaClient();
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
      });

      if (!account) {
        return undefined;
      }

      await prisma.account.delete({ where: { id: account.id } });
      return toAdapterAccount(account);
    },

    async getAccount(providerAccountId, provider) {
      const account = await getPrismaClient().account.findUnique({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
      });

      return account ? toAdapterAccount(account) : null;
    },

    async createSession(session) {
      const createdSession = await getPrismaClient().session.create({
        data: {
          sessionToken: session.sessionToken,
          userId: parseUserId(session.userId),
          expires: session.expires,
        },
      });

      return toAdapterSession(createdSession);
    },

    async getSessionAndUser(sessionToken) {
      const session = await getPrismaClient().session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });

      if (!session) {
        return null;
      }

      return {
        session: toAdapterSession(session),
        user: toAdapterUser(session.user),
      };
    },

    async updateSession(session) {
      const prisma = getPrismaClient();
      const existingSession = await prisma.session.findUnique({
        where: { sessionToken: session.sessionToken },
      });

      if (!existingSession) {
        return null;
      }

      const updatedSession = await prisma.session.update({
        where: { sessionToken: session.sessionToken },
        data: {
          ...(session.userId === undefined
            ? {}
            : { userId: parseUserId(session.userId) }),
          ...(session.expires === undefined
            ? {}
            : { expires: session.expires }),
        },
      });

      return toAdapterSession(updatedSession);
    },

    async deleteSession(sessionToken) {
      const prisma = getPrismaClient();
      const session = await prisma.session.findUnique({
        where: { sessionToken },
      });

      if (!session) {
        return null;
      }

      await prisma.session.delete({ where: { sessionToken } });
      return toAdapterSession(session);
    },
  };
}
