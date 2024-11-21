/*
  Warnings:

  - You are about to drop the column `type` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `publicKey` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "type",
ADD COLUMN     "roomType" "RoomType" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "publicKey",
ADD COLUMN     "encryptionKeyId" TEXT;

-- DropEnum
DROP TYPE "Type";

-- CreateTable
CREATE TABLE "EncryptionKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncryptionKey_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_encryptionKeyId_fkey" FOREIGN KEY ("encryptionKeyId") REFERENCES "EncryptionKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptionKey" ADD CONSTRAINT "EncryptionKey_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
