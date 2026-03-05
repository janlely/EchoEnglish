/*
  Warnings:

  - You are about to drop the column `chatSessionId` on the `Message` table. All the data in the column will be lost.
  - Added the required column `msgId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Made the column `conversationId` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "avatarUrl" TEXT,
    "latestMsgId" TEXT,
    "latestSummary" TEXT,
    "latestSenderId" TEXT,
    "latestTimestamp" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Conversation" ("avatarUrl", "createdAt", "id", "latestMsgId", "latestSenderId", "latestSummary", "latestTimestamp", "name", "type", "updatedAt") SELECT "avatarUrl", "createdAt", "id", "latestMsgId", "latestSenderId", "latestSummary", "latestTimestamp", "name", "type", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");
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
    "chat_type" TEXT NOT NULL DEFAULT 'direct',
    "target_id" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("conversationId", "createdAt", "id", "senderId", "status", "text", "type", "updatedAt") SELECT "conversationId", "createdAt", "id", "senderId", "status", "text", "type", "updatedAt" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE UNIQUE INDEX "Message_msgId_key" ON "Message"("msgId");
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Message_msgId_idx" ON "Message"("msgId");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");
CREATE TABLE "new_UserConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lastReadMsgId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserConversation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserConversation" ("conversationId", "id", "lastReadMsgId", "unreadCount", "updatedAt", "userId") SELECT "conversationId", "id", "lastReadMsgId", "unreadCount", "updatedAt", "userId" FROM "UserConversation";
DROP TABLE "UserConversation";
ALTER TABLE "new_UserConversation" RENAME TO "UserConversation";
CREATE INDEX "UserConversation_userId_idx" ON "UserConversation"("userId");
CREATE INDEX "UserConversation_conversationId_idx" ON "UserConversation"("conversationId");
CREATE UNIQUE INDEX "UserConversation_userId_conversationId_key" ON "UserConversation"("userId", "conversationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
