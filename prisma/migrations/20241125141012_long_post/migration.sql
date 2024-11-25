-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('LONG', 'SHORT');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "longPostId" TEXT,
ADD COLUMN     "type" "PostType" NOT NULL DEFAULT 'SHORT';

-- CreateTable
CREATE TABLE "LongPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LongPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LongPostBlock" (
    "id" TEXT NOT NULL,
    "longPostId" TEXT NOT NULL,
    "text" TEXT,
    "media" TEXT,
    "mediaType" TEXT,

    CONSTRAINT "LongPostBlock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_longPostId_fkey" FOREIGN KEY ("longPostId") REFERENCES "LongPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongPost" ADD CONSTRAINT "LongPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongPostBlock" ADD CONSTRAINT "LongPostBlock_longPostId_fkey" FOREIGN KEY ("longPostId") REFERENCES "LongPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
