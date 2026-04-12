-- CreateEnum
CREATE TYPE "VideoCategory" AS ENUM ('ENTERTAINMENT', 'EDUCATIONAL_DIY', 'LIVE_EVENT');

-- CreateEnum
CREATE TYPE "StreamQuality" AS ENUM ('P720', 'P1080', 'P4K');

-- CreateEnum
CREATE TYPE "ProductionTier" AS ENUM ('STANDARD', 'PRO');

-- CreateEnum
CREATE TYPE "CoinTxnType" AS ENUM ('PURCHASE_STRIPE', 'PURCHASE_APPLE', 'PURCHASE_GOOGLE', 'SPEND_UNLOCK', 'CREATOR_EARN', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CoinPurchaseProvider" AS ENUM ('STRIPE', 'APPLE', 'GOOGLE');

-- CreateEnum
CREATE TYPE "CoinPurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "baseRateMinorPerMinute" INTEGER,
ADD COLUMN     "monetizationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionTier" "ProductionTier" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "videoCategory" "VideoCategory",
ADD COLUMN     "videoDurationSeconds" INTEGER;

-- CreateTable
CREATE TABLE "CoinWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "CoinTxnType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "balanceAfterMinor" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coinsMinor" INTEGER NOT NULL,
    "stripePriceId" TEXT,
    "appleProductId" TEXT,
    "googleProductId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoinPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "provider" "CoinPurchaseProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "CoinPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "coinsMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "maxStreamQuality" "StreamQuality" NOT NULL,
    "totalPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "platformFeeAccumulatedMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoinWallet_userId_key" ON "CoinWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinLedgerEntry_idempotencyKey_key" ON "CoinLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CoinPurchase_provider_externalId_key" ON "CoinPurchase"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PostUnlock_userId_postId_key" ON "PostUnlock"("userId", "postId");

-- AddForeignKey
ALTER TABLE "CoinWallet" ADD CONSTRAINT "CoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CoinWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinPurchase" ADD CONSTRAINT "CoinPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinPurchase" ADD CONSTRAINT "CoinPurchase_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CoinPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostUnlock" ADD CONSTRAINT "PostUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostUnlock" ADD CONSTRAINT "PostUnlock_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
