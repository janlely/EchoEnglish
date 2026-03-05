/*
  Warnings:

  - You are about to drop the `ChatParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChatSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserConversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `type` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `chat_type` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `target_id` on the `Message` table. All the data in the column will be lost.
  - Added the required column `groupId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ChatParticipant_userId_chatSessionId_key";

-- DropIndex
DROP INDEX "ChatParticipant_chatSessionId_idx";

-- DropIndex
DROP INDEX "ChatParticipant_userId_idx";

-- DropIndex
DROP INDEX "ChatSession_type_idx";

-- DropIndex
DROP INDEX "UserConversation_userId_conversationId_key";

-- DropIndex
DROP INDEX "UserConversation_conversationId_idx";

-- DropIndex
DROP INDEX "UserConversation_userId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChatParticipant";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChatSession";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserConversation";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserConversationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "lastReadMsgId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserConversationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactSyncCursor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "friendCursor" INTEGER NOT NULL DEFAULT 0,
    "groupCursor" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "latestMsgId" TEXT,
    "latestSummary" TEXT,
    "latestSenderId" TEXT,
    "latestTimestamp" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Conversation" ("avatarUrl", "createdAt", "id", "latestMsgId", "latestSenderId", "latestSummary", "latestTimestamp", "name", "updatedAt") SELECT "avatarUrl", "createdAt", "id", "latestMsgId", "latestSenderId", "latestSummary", "latestTimestamp", "name", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_latestTimestamp_idx" ON "Conversation"("latestTimestamp");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "msgId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("conversationId", "createdAt", "id", "msgId", "senderId", "status", "text", "type", "updatedAt") SELECT "conversationId", "createdAt", "id", "msgId", "senderId", "status", "text", "type", "updatedAt" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE UNIQUE INDEX "Message_msgId_key" ON "Message"("msgId");
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Message_msgId_idx" ON "Message"("msgId");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Group_ownerId_idx" ON "Group"("ownerId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "UserConversationState_userId_idx" ON "UserConversationState"("userId");

-- CreateIndex
CREATE INDEX "UserConversationState_conversationId_idx" ON "UserConversationState"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConversationState_userId_conversationId_key" ON "UserConversationState"("userId", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSyncCursor_userId_key" ON "ContactSyncCursor"("userId");

-- CreateIndex
CREATE INDEX "ContactSyncCursor_userId_idx" ON "ContactSyncCursor"("userId");
