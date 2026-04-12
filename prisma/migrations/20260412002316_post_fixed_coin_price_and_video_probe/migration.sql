-- AlterTable
ALTER TABLE "File" ADD COLUMN     "videoDurationSeconds" INTEGER,
ADD COLUMN     "videoHeight" INTEGER,
ADD COLUMN     "videoWidth" INTEGER;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "pricedCostMinor" INTEGER,
ADD COLUMN     "sourceStreamQuality" "StreamQuality";
