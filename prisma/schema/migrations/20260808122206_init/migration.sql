-- CreateEnum
CREATE TYPE "CodexStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CodexEntityType" AS ENUM ('COMMANDER', 'EQUIPMENT', 'TALENT', 'CIVILIZATION', 'TROOP', 'EVENT');

-- CreateEnum
CREATE TYPE "CommanderRarity" AS ENUM ('ADVANCED', 'ELITE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "EquipmentRarity" AS ENUM ('NORMAL', 'ADVANCED', 'ELITE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "CodexSourceKind" AS ENUM ('MANUAL_EDITORIAL', 'COMMUNITY_SUBMISSION', 'PUBLIC_PATCH_NOTE', 'PARTNER_IMPORT');

-- CreateEnum
CREATE TYPE "ForumContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'MISINFORMATION', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('vi', 'en');

-- CreateEnum
CREATE TYPE "UserRoleName" AS ENUM ('MEMBER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN', 'R4', 'R5');

-- CreateEnum
CREATE TYPE "ReputationReason" AS ENUM ('TOPIC_UPVOTED', 'REPLY_UPVOTED', 'CODEX_APPROVED', 'MODERATION_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('PROFILE_SCREENSHOT', 'FORUM_ATTACHMENT', 'CODEX_EVIDENCE', 'ALLIANCE_CSV');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubmissionEntityType" AS ENUM ('COMMANDER', 'EQUIPMENT', 'TALENT', 'CIVILIZATION', 'TROOP', 'EVENT', 'GOVERNOR_PROFILE');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES');

-- CreateEnum
CREATE TYPE "GovernorVerificationStatus" AS ENUM ('SELF_REPORTED', 'SCREENSHOT_VERIFIED', 'MODERATOR_VERIFIED');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('SELF_REPORTED', 'SCREENSHOT_OCR', 'ALLIANCE_CSV', 'MODERATOR_ENTRY');

-- CreateTable
CREATE TABLE "Patch" (
    "id" TEXT NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "titleKey" VARCHAR(191),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Civilization" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "status" "CodexStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Civilization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commander" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "civilizationId" TEXT,
    "rarity" "CommanderRarity" NOT NULL,
    "status" "CodexStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceKind" "CodexSourceKind" NOT NULL DEFAULT 'MANUAL_EDITORIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commander_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommanderSkill" (
    "id" TEXT NOT NULL,
    "commanderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "CommanderSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "tree" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommanderTalent" (
    "commanderId" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,

    CONSTRAINT "CommanderTalent_pkey" PRIMARY KEY ("commanderId","talentId")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "rarity" "EquipmentRarity" NOT NULL,
    "slot" VARCHAR(50) NOT NULL,
    "stats" JSONB NOT NULL,
    "recipe" JSONB,
    "status" "CodexStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceKind" "CodexSourceKind" NOT NULL DEFAULT 'MANUAL_EDITORIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Troop" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "civilizationId" TEXT,
    "tier" INTEGER NOT NULL,
    "troopType" VARCHAR(50) NOT NULL,
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Troop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "CodexStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodexRevision" (
    "id" TEXT NOT NULL,
    "entityType" "CodexEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "commanderId" TEXT,
    "editorId" TEXT NOT NULL,
    "patchId" TEXT,
    "sourceKind" "CodexSourceKind" NOT NULL,
    "sourceNote" TEXT,
    "changeNote" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodexRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "descriptionKey" VARCHAR(191),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "locale" "Locale" NOT NULL DEFAULT 'vi',
    "status" "ForumContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "isAcceptedAnswer" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "locale" "Locale" NOT NULL DEFAULT 'vi',
    "status" "ForumContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicVote" (
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicVote_pkey" PRIMARY KEY ("topicId","userId")
);

-- CreateTable
CREATE TABLE "ReplyVote" (
    "replyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplyVote_pkey" PRIMARY KEY ("replyId","userId")
);

-- CreateTable
CREATE TABLE "ForumReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "topicId" TEXT,
    "replyId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicTag" (
    "topicId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "isVerifiedTag" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "TopicTag_pkey" PRIMARY KEY ("topicId","tagId")
);

-- CreateTable
CREATE TABLE "I18nMessage" (
    "key" VARCHAR(191) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "I18nMessage_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "I18nTranslation" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "I18nTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100),
    "displayName" VARCHAR(100),
    "email" VARCHAR(320),
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "googleSub" VARCHAR(255),
    "locale" "Locale" NOT NULL DEFAULT 'vi',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "role" "UserRoleName" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "ReputationReason" NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceRef" VARCHAR(191),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "objectKey" VARCHAR(512) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrJob" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "governorProfileId" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "confidence" JSONB,
    "errorCode" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionSubmission" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "entityType" "SubmissionEntityType" NOT NULL,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReview" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "submissionId" TEXT,
    "ocrJobId" TEXT,
    "decision" "ModerationDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CsvImportJob" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "summary" JSONB,
    "errorCode" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CsvImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kingdom" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kingdom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" TEXT NOT NULL,
    "kingdomId" TEXT NOT NULL,
    "tag" VARCHAR(16) NOT NULL,
    "name" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernorProfile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "governorId" VARCHAR(32) NOT NULL,
    "governorName" VARCHAR(120) NOT NULL,
    "kingdomId" TEXT,
    "allianceId" TEXT,
    "verificationStatus" "GovernorVerificationStatus" NOT NULL DEFAULT 'SELF_REPORTED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernorSnapshot" (
    "id" TEXT NOT NULL,
    "governorProfileId" TEXT NOT NULL,
    "power" BIGINT NOT NULL,
    "killPoints" BIGINT NOT NULL,
    "deadTroops" BIGINT NOT NULL,
    "source" "MetricSource" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "evidenceUploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patch_version_key" ON "Patch"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Patch_titleKey_key" ON "Patch"("titleKey");

-- CreateIndex
CREATE UNIQUE INDEX "Civilization_slug_key" ON "Civilization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Civilization_nameKey_key" ON "Civilization"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Commander_slug_key" ON "Commander"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Commander_nameKey_key" ON "Commander"("nameKey");

-- CreateIndex
CREATE INDEX "Commander_status_rarity_idx" ON "Commander"("status", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "CommanderSkill_nameKey_key" ON "CommanderSkill"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommanderSkill_commanderId_position_key" ON "CommanderSkill"("commanderId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Talent_slug_key" ON "Talent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Talent_nameKey_key" ON "Talent"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_slug_key" ON "Equipment"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_nameKey_key" ON "Equipment"("nameKey");

-- CreateIndex
CREATE INDEX "Equipment_status_slot_idx" ON "Equipment"("status", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Troop_slug_key" ON "Troop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Troop_nameKey_key" ON "Troop"("nameKey");

-- CreateIndex
CREATE INDEX "Troop_troopType_tier_idx" ON "Troop"("troopType", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_slug_key" ON "GameEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_nameKey_key" ON "GameEvent"("nameKey");

-- CreateIndex
CREATE INDEX "CodexRevision_entityType_entityId_createdAt_idx" ON "CodexRevision"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "CodexRevision_editorId_idx" ON "CodexRevision"("editorId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_nameKey_key" ON "Category"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Category_descriptionKey_key" ON "Category"("descriptionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_categoryId_createdAt_idx" ON "Topic"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Topic_authorId_idx" ON "Topic"("authorId");

-- CreateIndex
CREATE INDEX "Topic_status_updatedAt_idx" ON "Topic"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Topic_deletedAt_idx" ON "Topic"("deletedAt");

-- CreateIndex
CREATE INDEX "Reply_topicId_createdAt_idx" ON "Reply"("topicId", "createdAt");

-- CreateIndex
CREATE INDEX "Reply_authorId_idx" ON "Reply"("authorId");

-- CreateIndex
CREATE INDEX "Reply_deletedAt_idx" ON "Reply"("deletedAt");

-- CreateIndex
CREATE INDEX "TopicVote_userId_idx" ON "TopicVote"("userId");

-- CreateIndex
CREATE INDEX "ReplyVote_userId_idx" ON "ReplyVote"("userId");

-- CreateIndex
CREATE INDEX "ForumReport_status_createdAt_idx" ON "ForumReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ForumReport_reporterId_idx" ON "ForumReport"("reporterId");

-- CreateIndex
CREATE INDEX "ForumReport_reporterId_createdAt_idx" ON "ForumReport"("reporterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_nameKey_key" ON "Tag"("nameKey");

-- CreateIndex
CREATE INDEX "TopicTag_tagId_idx" ON "TopicTag"("tagId");

-- CreateIndex
CREATE INDEX "I18nTranslation_locale_idx" ON "I18nTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "I18nTranslation_messageId_locale_key" ON "I18nTranslation"("messageId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "ReputationEvent_userId_createdAt_idx" ON "ReputationEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadAsset_objectKey_key" ON "UploadAsset"("objectKey");

-- CreateIndex
CREATE INDEX "UploadAsset_ownerId_createdAt_idx" ON "UploadAsset"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OcrJob_uploadId_key" ON "OcrJob"("uploadId");

-- CreateIndex
CREATE INDEX "OcrJob_status_createdAt_idx" ON "OcrJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionSubmission_status_createdAt_idx" ON "IngestionSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionSubmission_submitterId_idx" ON "IngestionSubmission"("submitterId");

-- CreateIndex
CREATE INDEX "ModerationReview_moderatorId_createdAt_idx" ON "ModerationReview"("moderatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CsvImportJob_uploadId_key" ON "CsvImportJob"("uploadId");

-- CreateIndex
CREATE INDEX "CsvImportJob_status_createdAt_idx" ON "CsvImportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CsvImportJob_allianceId_idx" ON "CsvImportJob"("allianceId");

-- CreateIndex
CREATE UNIQUE INDEX "Kingdom_number_key" ON "Kingdom"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_kingdomId_tag_key" ON "Alliance"("kingdomId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "GovernorProfile_governorId_key" ON "GovernorProfile"("governorId");

-- CreateIndex
CREATE INDEX "GovernorProfile_ownerId_idx" ON "GovernorProfile"("ownerId");

-- CreateIndex
CREATE INDEX "GovernorProfile_kingdomId_idx" ON "GovernorProfile"("kingdomId");

-- CreateIndex
CREATE INDEX "GovernorProfile_allianceId_idx" ON "GovernorProfile"("allianceId");

-- CreateIndex
CREATE INDEX "GovernorSnapshot_governorProfileId_capturedAt_idx" ON "GovernorSnapshot"("governorProfileId", "capturedAt");

-- AddForeignKey
ALTER TABLE "Patch" ADD CONSTRAINT "Patch_titleKey_fkey" FOREIGN KEY ("titleKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Civilization" ADD CONSTRAINT "Civilization_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commander" ADD CONSTRAINT "Commander_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commander" ADD CONSTRAINT "Commander_civilizationId_fkey" FOREIGN KEY ("civilizationId") REFERENCES "Civilization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommanderSkill" ADD CONSTRAINT "CommanderSkill_commanderId_fkey" FOREIGN KEY ("commanderId") REFERENCES "Commander"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommanderSkill" ADD CONSTRAINT "CommanderSkill_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommanderTalent" ADD CONSTRAINT "CommanderTalent_commanderId_fkey" FOREIGN KEY ("commanderId") REFERENCES "Commander"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommanderTalent" ADD CONSTRAINT "CommanderTalent_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Troop" ADD CONSTRAINT "Troop_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Troop" ADD CONSTRAINT "Troop_civilizationId_fkey" FOREIGN KEY ("civilizationId") REFERENCES "Civilization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodexRevision" ADD CONSTRAINT "CodexRevision_commanderId_fkey" FOREIGN KEY ("commanderId") REFERENCES "Commander"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodexRevision" ADD CONSTRAINT "CodexRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodexRevision" ADD CONSTRAINT "CodexRevision_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "Patch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_descriptionKey_fkey" FOREIGN KEY ("descriptionKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicVote" ADD CONSTRAINT "TopicVote_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicVote" ADD CONSTRAINT "TopicVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyVote" ADD CONSTRAINT "ReplyVote_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyVote" ADD CONSTRAINT "ReplyVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_nameKey_fkey" FOREIGN KEY ("nameKey") REFERENCES "I18nMessage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicTag" ADD CONSTRAINT "TopicTag_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicTag" ADD CONSTRAINT "TopicTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "I18nTranslation" ADD CONSTRAINT "I18nTranslation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "I18nMessage"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAsset" ADD CONSTRAINT "UploadAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_governorProfileId_fkey" FOREIGN KEY ("governorProfileId") REFERENCES "GovernorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionSubmission" ADD CONSTRAINT "IngestionSubmission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "IngestionSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReview" ADD CONSTRAINT "ModerationReview_ocrJobId_fkey" FOREIGN KEY ("ocrJobId") REFERENCES "OcrJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CsvImportJob" ADD CONSTRAINT "CsvImportJob_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CsvImportJob" ADD CONSTRAINT "CsvImportJob_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CsvImportJob" ADD CONSTRAINT "CsvImportJob_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "UploadAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alliance" ADD CONSTRAINT "Alliance_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernorProfile" ADD CONSTRAINT "GovernorProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernorProfile" ADD CONSTRAINT "GovernorProfile_kingdomId_fkey" FOREIGN KEY ("kingdomId") REFERENCES "Kingdom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernorProfile" ADD CONSTRAINT "GovernorProfile_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernorSnapshot" ADD CONSTRAINT "GovernorSnapshot_governorProfileId_fkey" FOREIGN KEY ("governorProfileId") REFERENCES "GovernorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernorSnapshot" ADD CONSTRAINT "GovernorSnapshot_evidenceUploadId_fkey" FOREIGN KEY ("evidenceUploadId") REFERENCES "UploadAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
