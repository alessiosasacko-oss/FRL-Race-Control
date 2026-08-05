-- Add an explicit lock timestamp without changing the existing active-user flag.
ALTER TABLE "User" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- Short-lived Discord OAuth handshakes store only a SHA-256 state digest.
CREATE TABLE "MobileOAuthAttempt" (
    "id" TEXT NOT NULL,
    "oauthStateHash" CHAR(64) NOT NULL,
    "clientState" VARCHAR(255) NOT NULL,
    "codeChallenge" VARCHAR(128) NOT NULL,
    "codeChallengeMethod" VARCHAR(8) NOT NULL,
    "redirectUri" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileOAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- App authorization codes are one-time credentials and are never stored raw.
CREATE TABLE "MobileAuthorizationCode" (
    "id" TEXT NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "userId" INTEGER NOT NULL,
    "oauthAttemptId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- Mobile sessions are isolated from Auth.js web sessions.
CREATE TABLE "MobileSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenFamilyId" UUID NOT NULL,
    "platform" VARCHAR(32),
    "deviceName" VARCHAR(160),
    "appVersion" VARCHAR(40),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id")
);

-- Retaining consumed token hashes makes refresh-token reuse detectable.
CREATE TABLE "MobileRefreshToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_lockedAt_idx" ON "User"("lockedAt");
CREATE UNIQUE INDEX "MobileOAuthAttempt_oauthStateHash_key" ON "MobileOAuthAttempt"("oauthStateHash");
CREATE INDEX "MobileOAuthAttempt_expiresAt_idx" ON "MobileOAuthAttempt"("expiresAt");
CREATE INDEX "MobileOAuthAttempt_completedAt_idx" ON "MobileOAuthAttempt"("completedAt");
CREATE UNIQUE INDEX "MobileAuthorizationCode_codeHash_key" ON "MobileAuthorizationCode"("codeHash");
CREATE UNIQUE INDEX "MobileAuthorizationCode_oauthAttemptId_key" ON "MobileAuthorizationCode"("oauthAttemptId");
CREATE INDEX "MobileAuthorizationCode_userId_createdAt_idx" ON "MobileAuthorizationCode"("userId", "createdAt");
CREATE INDEX "MobileAuthorizationCode_expiresAt_idx" ON "MobileAuthorizationCode"("expiresAt");
CREATE INDEX "MobileAuthorizationCode_usedAt_idx" ON "MobileAuthorizationCode"("usedAt");
CREATE UNIQUE INDEX "MobileSession_tokenFamilyId_key" ON "MobileSession"("tokenFamilyId");
CREATE INDEX "MobileSession_userId_revokedAt_expiresAt_idx" ON "MobileSession"("userId", "revokedAt", "expiresAt");
CREATE INDEX "MobileSession_expiresAt_idx" ON "MobileSession"("expiresAt");
CREATE INDEX "MobileSession_revokedAt_idx" ON "MobileSession"("revokedAt");
CREATE UNIQUE INDEX "MobileRefreshToken_tokenHash_key" ON "MobileRefreshToken"("tokenHash");
CREATE INDEX "MobileRefreshToken_sessionId_createdAt_idx" ON "MobileRefreshToken"("sessionId", "createdAt");
CREATE INDEX "MobileRefreshToken_expiresAt_idx" ON "MobileRefreshToken"("expiresAt");
CREATE INDEX "MobileRefreshToken_usedAt_idx" ON "MobileRefreshToken"("usedAt");
CREATE INDEX "MobileRefreshToken_revokedAt_idx" ON "MobileRefreshToken"("revokedAt");

ALTER TABLE "MobileAuthorizationCode"
ADD CONSTRAINT "MobileAuthorizationCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileAuthorizationCode"
ADD CONSTRAINT "MobileAuthorizationCode_oauthAttemptId_fkey"
FOREIGN KEY ("oauthAttemptId") REFERENCES "MobileOAuthAttempt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileSession"
ADD CONSTRAINT "MobileSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileRefreshToken"
ADD CONSTRAINT "MobileRefreshToken_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MobileSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
