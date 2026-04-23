-- AlterTable
ALTER TABLE "User" ADD COLUMN     "e2eePrivateKeyBackupCiphertext" TEXT,
ADD COLUMN     "e2eePrivateKeyBackupMeta" JSONB;
