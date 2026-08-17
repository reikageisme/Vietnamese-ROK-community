-- Public scan ordering, credit wallet, and private operations workflow.
CREATE TYPE "ScanProduct" AS ENUM ('KINGDOM_OVERVIEW', 'GOVERNOR_TOP_300', 'KVK_CAMP');
CREATE TYPE "ScanServiceStatus" AS ENUM ('QUEUED', 'ASSIGNED', 'RUNNING', 'REVIEWING', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "CreditTransactionKind" AS ENUM ('TOP_UP', 'SCAN_CHARGE', 'REFUND', 'ADMIN_ADJUSTMENT');

CREATE TABLE "CreditWallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "actorId" TEXT,
  "kind" "CreditTransactionKind" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reference" VARCHAR(191),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScanServiceRequest" (
  "id" TEXT NOT NULL,
  "requestCode" VARCHAR(32) NOT NULL,
  "requesterId" TEXT NOT NULL,
  "kingdomNumber" INTEGER NOT NULL,
  "product" "ScanProduct" NOT NULL,
  "costCredits" INTEGER NOT NULL,
  "status" "ScanServiceStatus" NOT NULL DEFAULT 'QUEUED',
  "note" TEXT,
  "assignedDeviceId" VARCHAR(100),
  "collectorBatchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ScanServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TopUpRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "amountVnd" INTEGER NOT NULL,
  "credits" INTEGER NOT NULL,
  "transferReference" VARCHAR(100) NOT NULL,
  "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "TopUpRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "CreditWallet"("userId");
CREATE INDEX "CreditTransaction_walletId_createdAt_idx" ON "CreditTransaction"("walletId", "createdAt");
CREATE INDEX "CreditTransaction_reference_idx" ON "CreditTransaction"("reference");
CREATE UNIQUE INDEX "ScanServiceRequest_requestCode_key" ON "ScanServiceRequest"("requestCode");
CREATE INDEX "ScanServiceRequest_requesterId_createdAt_idx" ON "ScanServiceRequest"("requesterId", "createdAt");
CREATE INDEX "ScanServiceRequest_status_createdAt_idx" ON "ScanServiceRequest"("status", "createdAt");
CREATE INDEX "ScanServiceRequest_kingdomNumber_createdAt_idx" ON "ScanServiceRequest"("kingdomNumber", "createdAt");
CREATE INDEX "TopUpRequest_requesterId_createdAt_idx" ON "TopUpRequest"("requesterId", "createdAt");
CREATE INDEX "TopUpRequest_status_createdAt_idx" ON "TopUpRequest"("status", "createdAt");
CREATE UNIQUE INDEX "TopUpRequest_requesterId_transferReference_key" ON "TopUpRequest"("requesterId", "transferReference");

ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScanServiceRequest" ADD CONSTRAINT "ScanServiceRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScanServiceRequest" ADD CONSTRAINT "ScanServiceRequest_collectorBatchId_fkey" FOREIGN KEY ("collectorBatchId") REFERENCES "CollectorBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
