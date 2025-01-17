-- AlterTable
ALTER TABLE "_bookmarkedPosts" ADD CONSTRAINT "_bookmarkedPosts_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_bookmarkedPosts_AB_unique";

-- AlterTable
ALTER TABLE "_likedPosts" ADD CONSTRAINT "_likedPosts_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_likedPosts_AB_unique";
