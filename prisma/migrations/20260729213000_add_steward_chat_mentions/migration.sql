ALTER TABLE "DiscussionMessage"
ADD COLUMN "clientMessageId" VARCHAR(36);

CREATE UNIQUE INDEX "DiscussionMessage_clientMessageId_key"
ON "DiscussionMessage"("clientMessageId");

CREATE TABLE "DiscussionMention" (
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionMention_pkey" PRIMARY KEY ("messageId", "userId")
);

CREATE INDEX "DiscussionMention_userId_createdAt_idx"
ON "DiscussionMention"("userId", "createdAt");

ALTER TABLE "DiscussionMention"
ADD CONSTRAINT "DiscussionMention_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "DiscussionMessage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionMention"
ADD CONSTRAINT "DiscussionMention_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
