-- Migration: Add Conversation and UserConversation tables
-- This migration creates the new conversation-based schema for optimized message queries

-- Create Conversation table
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "avatarUrl" TEXT,
    "latestMsgId" TEXT,
    "latestSummary" TEXT,
    "latestSenderId" TEXT,
    "latestTimestamp" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create UserConversation table
CREATE TABLE IF NOT EXISTS "UserConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lastReadMsgId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserConversation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index on Conversation table
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");
CREATE INDEX "Conversation_latestTimestamp_idx" ON "Conversation"("latestTimestamp");

-- Create unique index and indexes on UserConversation table
CREATE UNIQUE INDEX "UserConversation_userId_conversationId_key" ON "UserConversation"("userId", "conversationId");
CREATE INDEX "UserConversation_userId_idx" ON "UserConversation"("userId");
CREATE INDEX "UserConversation_conversationId_idx" ON "UserConversation"("conversationId");

-- Add conversationId column to Message table (nullable initially for migration)
ALTER TABLE "Message" ADD COLUMN "conversationId" TEXT;

-- Create index on conversationId
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- Migrate existing messages to use conversationId
-- For direct chat: conversationId = min(senderId, targetId) + '_' + max(senderId, targetId)
-- For group chat: conversationId = 'group_' + targetId
UPDATE "Message" 
SET "conversationId" = CASE 
    WHEN "chat_type" = 'group' THEN 'group_' || "target_id"
    WHEN "senderId" < "target_id" THEN "senderId" || '_' || "target_id"
    ELSE "target_id" || '_' || "senderId"
END;

-- Make conversationId NOT NULL after migration
-- Note: SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
-- For production, use Prisma migrate which handles this automatically

-- Create indexes for Message table
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Message_msgId_idx" ON "Message"("msgId");
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message"("createdAt");

-- Populate Conversation table from existing messages
INSERT OR IGNORE INTO "Conversation" ("id", "type", "name", "createdAt", "updatedAt")
SELECT DISTINCT 
    "conversationId",
    "chat_type",
    NULL,
    MIN("createdAt"),
    MAX("updatedAt")
FROM "Message"
GROUP BY "conversationId", "chat_type";

-- Update Conversation with latest message info
UPDATE "Conversation" 
SET 
    "latestMsgId" = (
        SELECT "msgId" FROM "Message" 
        WHERE "Message"."conversationId" = "Conversation"."id" 
        ORDER BY "createdAt" DESC 
        LIMIT 1
    ),
    "latestSummary" = (
        SELECT "text" FROM "Message" 
        WHERE "Message"."conversationId" = "Conversation"."id" 
        ORDER BY "createdAt" DESC 
        LIMIT 1
    ),
    "latestSenderId" = (
        SELECT "senderId" FROM "Message" 
        WHERE "Message"."conversationId" = "Conversation"."id" 
        ORDER BY "createdAt" DESC 
        LIMIT 1
    ),
    "latestTimestamp" = (
        SELECT "createdAt" FROM "Message" 
        WHERE "Message"."conversationId" = "Conversation"."id" 
        ORDER BY "createdAt" DESC 
        LIMIT 1
    );

-- Populate UserConversation table from existing ChatParticipant
-- For direct chat, create entries for both users
INSERT OR IGNORE INTO "UserConversation" ("id", "userId", "conversationId", "lastReadMsgId", "unreadCount", "updatedAt")
SELECT 
    lower(hex(randomblob(16))),
    "userId",
    "chatSessionId",
    "lastReadAt",
    0,
    "updatedAt"
FROM "ChatParticipant";

-- For direct chat conversations, ensure both users have UserConversation entries
INSERT OR IGNORE INTO "UserConversation" ("id", "userId", "conversationId", "lastReadMsgId", "unreadCount", "updatedAt")
SELECT DISTINCT
    lower(hex(randomblob(16))),
    "target_id" as "userId",
    CASE 
        WHEN "senderId" < "target_id" THEN "senderId" || '_' || "target_id"
        ELSE "target_id" || '_' || "senderId"
    END as "conversationId",
    NULL,
    0,
    CURRENT_TIMESTAMP
FROM "Message"
WHERE "chat_type" = 'direct';
