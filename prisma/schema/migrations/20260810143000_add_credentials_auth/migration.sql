-- Add credentials authentication without creating a second user table.
CREATE TYPE "SecurityActionPurpose" AS ENUM ('LINK_GOOGLE', 'SET_PASSWORD');

ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "loginMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Existing OAuth identities remain fully usable after introducing loginMethods.
UPDATE "User"
SET "loginMethods" = ARRAY['google']::TEXT[],
    "emailVerified" = COALESCE("emailVerified", CURRENT_TIMESTAMP)
WHERE "googleSub" IS NOT NULL;

CREATE TABLE "email_verification_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_action_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "SecurityActionPurpose" NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_action_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");
CREATE INDEX "email_verification_tokens_userId_expiresAt_idx" ON "email_verification_tokens"("userId", "expiresAt");
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");
CREATE UNIQUE INDEX "security_action_tokens_tokenHash_key" ON "security_action_tokens"("tokenHash");
CREATE INDEX "security_action_tokens_userId_purpose_expiresAt_idx" ON "security_action_tokens"("userId", "purpose", "expiresAt");

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_action_tokens" ADD CONSTRAINT "security_action_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
