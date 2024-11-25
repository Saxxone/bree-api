/*
  Warnings:

  - You are about to drop the column `authorId` on the `LongPost` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `LongPost` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "LongPost" DROP CONSTRAINT "LongPost_authorId_fkey";

-- AlterTable
ALTER TABLE "LongPost" DROP COLUMN "authorId",
DROP COLUMN "title",
ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "LongPost" ADD CONSTRAINT "LongPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
