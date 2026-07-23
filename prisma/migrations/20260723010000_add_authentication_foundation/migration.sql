-- Replace the Phase 3 role set with the canonical Phase 4 RBAC roles.
UPDATE "User"
SET "roles" = array_replace(
    "roles",
    'LEAGUE_MANAGER'::"Role",
    'ADMIN'::"Role"
);

CREATE TYPE "Role_new" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'FIA_PRESIDENT',
    'STEWARD',
    'TEAM_PRINCIPAL',
    'DRIVER'
);

ALTER TABLE "User" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "User"
ALTER COLUMN "roles" TYPE "Role_new"[]
USING ("roles"::text[]::"Role_new"[]);

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "User"
ALTER COLUMN "roles" SET DEFAULT ARRAY['DRIVER']::"Role"[];

-- Extend the canonical user with the Auth.js identity fields.
ALTER TABLE "User"
ADD COLUMN "email" VARCHAR(320),
ADD COLUMN "emailVerified" TIMESTAMP(3);

-- Store OAuth provider accounts separately from the canonical user.
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" VARCHAR(64),
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- Database-backed Auth.js sessions keep only their opaque token in the cookie.
CREATE TABLE "Session" (
    "sessionToken" VARCHAR(255) NOT NULL,
    "userId" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"
ON "Account"("provider", "providerAccountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

ALTER TABLE "Account"
ADD CONSTRAINT "Account_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
