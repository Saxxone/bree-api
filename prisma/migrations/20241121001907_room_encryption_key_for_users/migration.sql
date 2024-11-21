/*
  Warnings:

  - You are about to drop the column `encryptionKeyId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `EncryptionKey` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EncryptionKey" DROP CONSTRAINT "EncryptionKey_roomId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_encryptionKeyId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "encryptionKeyId";

-- DropTable
DROP TABLE "EncryptionKey";

-- CreateTable
CREATE TABLE "UserRoomKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "encryptionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRoomKey_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserRoomKey" ADD CONSTRAINT "UserRoomKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoomKey" ADD CONSTRAINT "UserRoomKey_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
