/*
  Warnings:

  - A unique constraint covering the columns `[userId,isRefreshToken]` on the table `AuthToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_userId_isRefreshToken_key" ON "AuthToken"("userId", "isRefreshToken");
