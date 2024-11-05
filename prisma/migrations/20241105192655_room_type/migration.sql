-- CreateEnum
CREATE TYPE "Type" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "type" "Type" NOT NULL DEFAULT 'PRIVATE';
