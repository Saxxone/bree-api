-- CreateTable
CREATE TABLE "PostWatchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostWatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostWatchHistory_userId_lastWatchedAt_idx" ON "PostWatchHistory"("userId", "lastWatchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostWatchHistory_userId_postId_key" ON "PostWatchHistory"("userId", "postId");

-- AddForeignKey
ALTER TABLE "PostWatchHistory" ADD CONSTRAINT "PostWatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostWatchHistory" ADD CONSTRAINT "PostWatchHistory_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
