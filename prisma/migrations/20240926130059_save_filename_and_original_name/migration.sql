/*
  Warnings:

  - You are about to drop the column `name` on the `File` table. All the data in the column will be lost.
  - Added the required column `filename` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalname` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "File" DROP COLUMN "name",
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "originalname" TEXT NOT NULL;
