-- Extend the provenance model for physical-device scans.
ALTER TYPE "UploadPurpose" ADD VALUE 'SCAN_EVIDENCE';

CREATE TYPE "KvkCampaignStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

CREATE TABLE "KvkCampaign" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "mapName" VARCHAR(120),
    "status" "KvkCampaignStatus" NOT NULL DEFAULT 'UPCOMING',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KvkCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KvkCamp" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KvkCamp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectorBatch" (
    "id" TEXT NOT NULL,
    "externalId" VARCHAR(191) NOT NULL,
    "deviceId" VARCHAR(100) NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "recordCount" INTEGER NOT NULL,
    "evidenceObjectKeys" JSONB,
    "payloadHash" CHAR(64) NOT NULL,
    "summary" JSONB,
    "errorCode" VARCHAR(100),
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectorBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KingdomSnapshot" (
    "id" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "collectorBatchId" TEXT,
    "power" BIGINT NOT NULL,
    "killPoints" BIGINT NOT NULL,
    "deadTroops" BIGINT NOT NULL,
    "t4Kills" BIGINT NOT NULL,
    "t5Kills" BIGINT NOT NULL,
    "governorCount" INTEGER NOT NULL,
    "coveragePercent" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KingdomSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KvkCampKingdom" (
    "campId" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KvkCampKingdom_pkey" PRIMARY KEY ("campId", "kingdomId")
);

ALTER TABLE "GovernorSnapshot"
    ADD COLUMN "t1Kills" BIGINT,
    ADD COLUMN "t2Kills" BIGINT,
    ADD COLUMN "t3Kills" BIGINT,
    ADD COLUMN "t4Kills" BIGINT,
    ADD COLUMN "t5Kills" BIGINT,
    ADD COLUMN "rangedPoints" BIGINT,
    ADD COLUMN "resourcesGathered" BIGINT,
    ADD COLUMN "helps" BIGINT,
    ADD COLUMN "collectorBatchId" TEXT;

CREATE UNIQUE INDEX "KvkCampaign_code_key" ON "KvkCampaign"("code");
CREATE UNIQUE INDEX "KvkCamp_campaignId_code_key" ON "KvkCamp"("campaignId", "code");
CREATE UNIQUE INDEX "CollectorBatch_externalId_key" ON "CollectorBatch"("externalId");
CREATE INDEX "CollectorBatch_kingdomId_capturedAt_idx" ON "CollectorBatch"("kingdomId", "capturedAt");
CREATE INDEX "CollectorBatch_status_createdAt_idx" ON "CollectorBatch"("status", "createdAt");
CREATE INDEX "CollectorBatch_deviceId_createdAt_idx" ON "CollectorBatch"("deviceId", "createdAt");
CREATE UNIQUE INDEX "KingdomSnapshot_collectorBatchId_key" ON "KingdomSnapshot"("collectorBatchId");
CREATE INDEX "KingdomSnapshot_kingdomId_capturedAt_idx" ON "KingdomSnapshot"("kingdomId", "capturedAt");
CREATE INDEX "KvkCampKingdom_kingdomId_idx" ON "KvkCampKingdom"("kingdomId");
CREATE INDEX "GovernorSnapshot_collectorBatchId_idx" ON "GovernorSnapshot"("collectorBatchId");

ALTER TABLE "KvkCamp" ADD CONSTRAINT "KvkCamp_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "KvkCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectorBatch" ADD CONSTRAINT "CollectorBatch_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KingdomSnapshot" ADD CONSTRAINT "KingdomSnapshot_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KingdomSnapshot" ADD CONSTRAINT "KingdomSnapshot_collectorBatchId_fkey" FOREIGN KEY ("collectorBatchId") REFERENCES "CollectorBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KvkCampKingdom" ADD CONSTRAINT "KvkCampKingdom_campId_fkey" FOREIGN KEY ("campId") REFERENCES "KvkCamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KvkCampKingdom" ADD CONSTRAINT "KvkCampKingdom_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernorSnapshot" ADD CONSTRAINT "GovernorSnapshot_collectorBatchId_fkey" FOREIGN KEY ("collectorBatchId") REFERENCES "CollectorBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
