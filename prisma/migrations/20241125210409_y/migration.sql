/*
  Warnings:

  - You are about to drop the column `mediaType` on the `LongPostBlock` table. All the data in the column will be lost.
  - The `media` column on the `LongPostBlock` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "LongPostBlock" DROP COLUMN "mediaType",
ADD COLUMN     "mediaTypes" TEXT[],
DROP COLUMN "media",
ADD COLUMN     "media" TEXT[];
