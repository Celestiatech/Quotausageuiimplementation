-- CreateEnum
CREATE TYPE "DiscountCodeType" AS ENUM ('percent', 'flat_rupees');

-- CreateEnum
CREATE TYPE "DiscountCodeTarget" AS ENUM ('all', 'wallet_topup', 'plan_pro', 'plan_coach');

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountCodeType" NOT NULL,
    "target" "DiscountCodeTarget" NOT NULL DEFAULT 'wallet_topup',
    "percentOff" INTEGER,
    "flatAmountRupees" INTEGER,
    "maxDiscountRupees" INTEGER,
    "minOrderRupees" INTEGER,
    "usageLimitTotal" INTEGER,
    "usageLimitPerUser" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "baseRupees" INTEGER NOT NULL,
    "discountRupees" INTEGER NOT NULL,
    "finalRupees" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "DiscountCode_active_target_code_idx" ON "DiscountCode"("active", "target", "code");

-- CreateIndex
CREATE INDEX "DiscountCode_createdAt_idx" ON "DiscountCode"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountRedemption_paymentId_key" ON "DiscountRedemption"("paymentId");

-- CreateIndex
CREATE INDEX "DiscountRedemption_discountCodeId_userId_idx" ON "DiscountRedemption"("discountCodeId", "userId");

-- CreateIndex
CREATE INDEX "DiscountRedemption_context_createdAt_idx" ON "DiscountRedemption"("context", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
