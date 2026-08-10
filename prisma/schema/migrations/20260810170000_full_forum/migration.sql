-- Extend the existing forum tables in place; no parallel ForumTopic/User graph.
ALTER TABLE "Category"
  ADD COLUMN "icon" VARCHAR(100),
  ADD COLUMN "topicCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastActivityAt" TIMESTAMP(3);

ALTER TABLE "Topic"
  ADD COLUMN "bodyHtml" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "replyCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "upvoteCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "downvoteCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReplyAt" TIMESTAMP(3),
  ADD COLUMN "lastReplyById" TEXT,
  ADD COLUMN "acceptedReplyId" TEXT;

ALTER TABLE "Reply"
  ADD COLUMN "bodyHtml" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "upvoteCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "downvoteCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ForumReport"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "actionTaken" TEXT;

ALTER TABLE "ForumReport" ALTER COLUMN "status" SET DEFAULT 'PENDING';
UPDATE "ForumReport" SET "status" = 'PENDING' WHERE "status" = 'OPEN';

-- One-time safe backfill. Runtime reads use denormalized counters only.
UPDATE "Topic" t SET
  "bodyHtml" = '<p>' || replace(replace(replace(t."body", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>',
  "replyCount" = (SELECT COUNT(*)::INTEGER FROM "Reply" r WHERE r."topicId" = t."id" AND r."deletedAt" IS NULL),
  "upvoteCount" = (SELECT COUNT(*)::INTEGER FROM "TopicVote" v WHERE v."topicId" = t."id" AND v."value" = 1),
  "downvoteCount" = (SELECT COUNT(*)::INTEGER FROM "TopicVote" v WHERE v."topicId" = t."id" AND v."value" = -1),
  "lastReplyAt" = (SELECT MAX(r."createdAt") FROM "Reply" r WHERE r."topicId" = t."id" AND r."deletedAt" IS NULL),
  "lastReplyById" = (SELECT r."authorId" FROM "Reply" r WHERE r."topicId" = t."id" AND r."deletedAt" IS NULL ORDER BY r."createdAt" DESC LIMIT 1),
  "acceptedReplyId" = (SELECT r."id" FROM "Reply" r WHERE r."topicId" = t."id" AND r."isAcceptedAnswer" = TRUE AND r."deletedAt" IS NULL ORDER BY r."createdAt" LIMIT 1);

UPDATE "Reply" r SET
  "bodyHtml" = '<p>' || replace(replace(replace(r."body", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>',
  "upvoteCount" = (SELECT COUNT(*)::INTEGER FROM "ReplyVote" v WHERE v."replyId" = r."id" AND v."value" = 1),
  "downvoteCount" = (SELECT COUNT(*)::INTEGER FROM "ReplyVote" v WHERE v."replyId" = r."id" AND v."value" = -1);

UPDATE "Category" c SET
  "topicCount" = (SELECT COUNT(*)::INTEGER FROM "Topic" t WHERE t."categoryId" = c."id" AND t."deletedAt" IS NULL),
  "lastActivityAt" = (SELECT MAX(COALESCE(t."lastReplyAt", t."createdAt")) FROM "Topic" t WHERE t."categoryId" = c."id" AND t."deletedAt" IS NULL);

CREATE UNIQUE INDEX "Topic_acceptedReplyId_key" ON "Topic"("acceptedReplyId");
CREATE INDEX "Topic_categoryId_isPinned_lastReplyAt_idx" ON "Topic"("categoryId", "isPinned", "lastReplyAt");
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_lastReplyById_fkey" FOREIGN KEY ("lastReplyById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_acceptedReplyId_fkey" FOREIGN KEY ("acceptedReplyId") REFERENCES "Reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "forum_bookmarks" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "topicId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_bookmarks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "forum_bookmarks_userId_topicId_key" ON "forum_bookmarks"("userId", "topicId");
CREATE INDEX "forum_bookmarks_topicId_idx" ON "forum_bookmarks"("topicId");
ALTER TABLE "forum_bookmarks" ADD CONSTRAINT "forum_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_bookmarks" ADD CONSTRAINT "forum_bookmarks_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "forum_subscriptions" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "topicId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "forum_subscriptions_userId_topicId_key" ON "forum_subscriptions"("userId", "topicId");
CREATE INDEX "forum_subscriptions_topicId_idx" ON "forum_subscriptions"("topicId");
ALTER TABLE "forum_subscriptions" ADD CONSTRAINT "forum_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_subscriptions" ADD CONSTRAINT "forum_subscriptions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "forum_mentions" (
  "id" TEXT NOT NULL, "replyId" TEXT NOT NULL, "mentionedUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_mentions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "forum_mentions_replyId_mentionedUserId_key" ON "forum_mentions"("replyId", "mentionedUserId");
CREATE INDEX "forum_mentions_mentionedUserId_createdAt_idx" ON "forum_mentions"("mentionedUserId", "createdAt");
ALTER TABLE "forum_mentions" ADD CONSTRAINT "forum_mentions_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_mentions" ADD CONSTRAINT "forum_mentions_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "forum_edit_history" (
  "id" TEXT NOT NULL, "targetType" "ForumEditTargetType" NOT NULL, "topicId" TEXT, "replyId" TEXT, "editedById" TEXT NOT NULL, "previousBody" TEXT NOT NULL, "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_edit_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "forum_edit_history_topicId_editedAt_idx" ON "forum_edit_history"("topicId", "editedAt");
CREATE INDEX "forum_edit_history_replyId_editedAt_idx" ON "forum_edit_history"("replyId", "editedAt");
ALTER TABLE "forum_edit_history" ADD CONSTRAINT "forum_edit_history_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_edit_history" ADD CONSTRAINT "forum_edit_history_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_edit_history" ADD CONSTRAINT "forum_edit_history_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "type" "ForumNotificationType" NOT NULL, "actorId" TEXT, "topicId" TEXT, "replyId" TEXT, "isRead" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "forum_moderation_audit_log" (
  "id" TEXT NOT NULL, "moderatorId" TEXT NOT NULL, "action" VARCHAR(100) NOT NULL, "targetType" VARCHAR(50) NOT NULL, "targetId" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_moderation_audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "forum_moderation_audit_log_moderatorId_createdAt_idx" ON "forum_moderation_audit_log"("moderatorId", "createdAt");
CREATE INDEX "forum_moderation_audit_log_targetType_targetId_idx" ON "forum_moderation_audit_log"("targetType", "targetId");
ALTER TABLE "forum_moderation_audit_log" ADD CONSTRAINT "forum_moderation_audit_log_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
