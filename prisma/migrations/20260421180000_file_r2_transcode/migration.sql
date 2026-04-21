-- CreateEnum
CREATE TYPE "FileTranscodeStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FilePlaybackKind" AS ENUM ('PROGRESSIVE', 'HLS');

-- AlterTable
ALTER TABLE "File" ADD COLUMN "transcodeStatus" "FileTranscodeStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- AlterTable
ALTER TABLE "File" ADD COLUMN "playbackKind" "FilePlaybackKind";

-- AlterTable
ALTER TABLE "File" ADD COLUMN "r2MainKey" TEXT;

-- AlterTable
ALTER TABLE "File" ADD COLUMN "r2ManifestKey" TEXT;

-- AlterTable: allow clearing path after offload to R2
ALTER TABLE "File" ALTER COLUMN "path" DROP NOT NULL;
