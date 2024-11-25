/*
  Warnings:

  - Made the column `text` on table `LongPostBlock` required. This step will fail if there are existing NULL values in that column.
  - Made the column `media` on table `LongPostBlock` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mediaType` on table `LongPostBlock` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "LongPostBlock" ALTER COLUMN "text" SET NOT NULL,
ALTER COLUMN "media" SET NOT NULL,
ALTER COLUMN "mediaType" SET NOT NULL;
