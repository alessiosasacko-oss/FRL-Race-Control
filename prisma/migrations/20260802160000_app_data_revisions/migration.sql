CREATE TABLE "AppDataRevision" (
    "scope" VARCHAR(40) NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppDataRevision_pkey" PRIMARY KEY ("scope")
);
