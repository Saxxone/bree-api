-- CreateIndex
-- Composite index for DM history pagination which always filters by roomId
-- and orders by createdAt desc.
CREATE INDEX "Chat_roomId_createdAt_idx" ON "Chat"("roomId", "createdAt");
