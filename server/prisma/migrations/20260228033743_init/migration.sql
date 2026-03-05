/*
  Warnings:

  - You are about to alter the column `friendCursor` on the `ContactSyncCursor` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `groupCursor` on the `ContactSyncCursor` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContactSyncCursor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "friendCursor" BIGINT NOT NULL DEFAULT 0,
    "groupCursor" BIGINT NOT NULL DEFAULT 0,
    "requestCursor" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ContactSyncCursor" ("friendCursor", "groupCursor", "id", "updatedAt", "userId") SELECT "friendCursor", "groupCursor", "id", "updatedAt", "userId" FROM "ContactSyncCursor";
DROP TABLE "ContactSyncCursor";
ALTER TABLE "new_ContactSyncCursor" RENAME TO "ContactSyncCursor";
CREATE UNIQUE INDEX "ContactSyncCursor_userId_key" ON "ContactSyncCursor"("userId");
CREATE INDEX "ContactSyncCursor_userId_idx" ON "ContactSyncCursor"("userId");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "msgId" TEXT NOT NULL,
    "conversationId" TEXT,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
