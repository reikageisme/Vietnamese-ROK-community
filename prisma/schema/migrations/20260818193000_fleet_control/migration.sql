CREATE TYPE "DeviceAgentStatus" AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE');
CREATE TYPE "CollectorDeviceStatus" AS ENUM ('READY', 'BUSY', 'OFFLINE', 'ERROR', 'DISABLED');
CREATE TYPE "GameCharacterStatus" AS ENUM ('READY', 'VERIFYING', 'INVALID', 'DISABLED');
CREATE TYPE "AutomationJobType" AS ENUM ('KINGDOM_FULL', 'RANKING_SEED', 'RANKING_ALLIANCE', 'RANKING_HONOR', 'KVK_DISCOVERY');
CREATE TYPE "AutomationJobStatus" AS ENUM ('QUEUED', 'LEASED', 'SWITCHING', 'SCANNING', 'UPLOADING', 'REVIEWING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "DeviceAgent" (
  "id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "hostname" VARCHAR(191) NOT NULL,
  "version" VARCHAR(40) NOT NULL,
  "status" "DeviceAgentStatus" NOT NULL DEFAULT 'OFFLINE',
  "capabilities" JSONB,
  "lastHeartbeatAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectorDevice" (
  "id" TEXT NOT NULL,
  "serial" VARCHAR(100) NOT NULL,
  "alias" VARCHAR(80) NOT NULL,
  "agentId" VARCHAR(100) NOT NULL,
  "model" VARCHAR(120),
  "adbState" VARCHAR(40),
  "resolution" VARCHAR(40),
  "batteryPercent" INTEGER,
  "status" "CollectorDeviceStatus" NOT NULL DEFAULT 'OFFLINE',
  "currentCharacterKey" VARCHAR(100),
  "lastHeartbeatAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectorDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameCharacter" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "accountLabel" VARCHAR(120),
  "governorId" VARCHAR(32),
  "kingdomNumber" INTEGER NOT NULL,
  "switchOrder" INTEGER NOT NULL DEFAULT 0,
  "switchRoute" JSONB NOT NULL,
  "scanRoutes" JSONB NOT NULL DEFAULT '{}',
  "status" "GameCharacterStatus" NOT NULL DEFAULT 'VERIFYING',
  "lastVerifiedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameCharacter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationJob" (
  "id" TEXT NOT NULL,
  "type" "AutomationJobType" NOT NULL,
  "status" "AutomationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "kingdomNumber" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 300,
  "scanName" VARCHAR(120) NOT NULL,
  "scheduleKey" VARCHAR(191),
  "serviceRequestId" TEXT,
  "assignedDeviceId" TEXT,
  "characterId" TEXT,
  "leaseOwner" VARCHAR(100),
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "progress" JSONB,
  "result" JSONB,
  "error" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KingdomScanPolicy" (
  "id" TEXT NOT NULL,
  "kingdomNumber" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "fullScan" BOOLEAN NOT NULL DEFAULT false,
  "amount" INTEGER NOT NULL DEFAULT 300,
  "cadenceMinutes" INTEGER NOT NULL DEFAULT 10080,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "activeKvk" BOOLEAN NOT NULL DEFAULT false,
  "reason" VARCHAR(191),
  "nextScanAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastQueuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KingdomScanPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankingScanBatch" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "kingdomNumber" INTEGER NOT NULL,
  "rankingType" "AutomationJobType" NOT NULL,
  "target" INTEGER NOT NULL DEFAULT 300,
  "recordCount" INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RankingScanBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankingScanEntry" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "name" VARCHAR(160),
  "score" BIGINT,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RankingScanEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectorDevice_serial_key" ON "CollectorDevice"("serial");
CREATE INDEX "CollectorDevice_agentId_status_idx" ON "CollectorDevice"("agentId", "status");
CREATE INDEX "CollectorDevice_status_lastHeartbeatAt_idx" ON "CollectorDevice"("status", "lastHeartbeatAt");
CREATE UNIQUE INDEX "GameCharacter_deviceId_key_key" ON "GameCharacter"("deviceId", "key");
CREATE INDEX "GameCharacter_kingdomNumber_status_idx" ON "GameCharacter"("kingdomNumber", "status");
CREATE INDEX "GameCharacter_deviceId_switchOrder_idx" ON "GameCharacter"("deviceId", "switchOrder");
CREATE UNIQUE INDEX "AutomationJob_serviceRequestId_key" ON "AutomationJob"("serviceRequestId");
CREATE UNIQUE INDEX "AutomationJob_scheduleKey_key" ON "AutomationJob"("scheduleKey");
CREATE INDEX "AutomationJob_status_scheduledAt_priority_idx" ON "AutomationJob"("status", "scheduledAt", "priority");
CREATE INDEX "AutomationJob_assignedDeviceId_status_idx" ON "AutomationJob"("assignedDeviceId", "status");
CREATE INDEX "AutomationJob_kingdomNumber_createdAt_idx" ON "AutomationJob"("kingdomNumber", "createdAt");
CREATE INDEX "AutomationJob_leaseExpiresAt_idx" ON "AutomationJob"("leaseExpiresAt");
CREATE UNIQUE INDEX "KingdomScanPolicy_kingdomNumber_key" ON "KingdomScanPolicy"("kingdomNumber");
CREATE INDEX "KingdomScanPolicy_enabled_nextScanAt_priority_idx" ON "KingdomScanPolicy"("enabled", "nextScanAt", "priority");
CREATE INDEX "KingdomScanPolicy_activeKvk_nextScanAt_idx" ON "KingdomScanPolicy"("activeKvk", "nextScanAt");
CREATE INDEX "DeviceAgent_status_lastHeartbeatAt_idx" ON "DeviceAgent"("status", "lastHeartbeatAt");
CREATE UNIQUE INDEX "RankingScanBatch_jobId_key" ON "RankingScanBatch"("jobId");
CREATE INDEX "RankingScanBatch_kingdomNumber_capturedAt_idx" ON "RankingScanBatch"("kingdomNumber", "capturedAt");
CREATE INDEX "RankingScanBatch_rankingType_capturedAt_idx" ON "RankingScanBatch"("rankingType", "capturedAt");
CREATE UNIQUE INDEX "RankingScanEntry_batchId_rank_key" ON "RankingScanEntry"("batchId", "rank");
CREATE INDEX "RankingScanEntry_batchId_score_idx" ON "RankingScanEntry"("batchId", "score");

ALTER TABLE "CollectorDevice" ADD CONSTRAINT "CollectorDevice_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "DeviceAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameCharacter" ADD CONSTRAINT "GameCharacter_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "CollectorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ScanServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_assignedDeviceId_fkey" FOREIGN KEY ("assignedDeviceId") REFERENCES "CollectorDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RankingScanBatch" ADD CONSTRAINT "RankingScanBatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutomationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingScanEntry" ADD CONSTRAINT "RankingScanEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RankingScanBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
