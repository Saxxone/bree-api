/*
  Warnings:

  - You are about to drop the `UserRoomKey` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserRoomKey" DROP CONSTRAINT "UserRoomKey_roomId_fkey";

-- DropForeignKey
ALTER TABLE "UserRoomKey" DROP CONSTRAINT "UserRoomKey_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "publicKey" TEXT;

-- DropTable
DROP TABLE "UserRoomKey";
