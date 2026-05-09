/*
  Warnings:

  - A unique constraint covering the columns `[flowToken]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'META',
ADD COLUMN     "flowSlots" TEXT,
ADD COLUMN     "flowState" TEXT,
ADD COLUMN     "flowToken" TEXT,
ADD COLUMN     "lastInboundAt" TIMESTAMP(3),
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'fr';

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_flowToken_key" ON "Conversation"("flowToken");

-- CreateIndex
CREATE INDEX "Conversation_flowToken_idx" ON "Conversation"("flowToken");
