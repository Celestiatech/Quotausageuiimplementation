-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('free', 'pro', 'coach');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('signup', 'login', 'password_reset');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('sent', 'failed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('auto_apply_terms', 'communication_opt_in');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter');

-- CreateEnum
CREATE TYPE "JobLogLevel" AS ENUM ('info', 'warn', 'error');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('submitted', 'skipped', 'failed');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "HireTxnType" AS ENUM ('credit_purchase', 'credit_bonus', 'debit_apply', 'refund_apply', 'admin_adjustment');

-- CreateEnum
CREATE TYPE "HireTxnStatus" AS ENUM ('posted', 'voided');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "avatar" TEXT,
    "phone" TEXT,
    "currentCity" TEXT,
    "addressLine" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "resumeFileName" TEXT,
    "resumeFilePath" TEXT,
    "resumeText" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "plan" "UserPlan" NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "quotaTotal" INTEGER NOT NULL DEFAULT 3,
    "quotaResetTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hireBalance" INTEGER NOT NULL DEFAULT 0,
    "hireSpent" INTEGER NOT NULL DEFAULT 0,
    "hirePurchased" INTEGER NOT NULL DEFAULT 0,
    "dailyHireUsed" INTEGER NOT NULL DEFAULT 0,
    "dailyHireCap" INTEGER NOT NULL DEFAULT 3,
    "dailyHireResetTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'signup',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT,
    "status" "EmailStatus" NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSecret" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoApplyJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT,
    "criteriaJson" JSONB NOT NULL,
    "profileSnapshot" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoApplyJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoApplyJobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" "JobLogLevel" NOT NULL DEFAULT 'info',
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoApplyJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "externalJobId" TEXT,
    "company" TEXT,
    "title" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "providerPlanId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "plan" "UserPlan" NOT NULL DEFAULT 'free',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "HireTxnType" NOT NULL,
    "status" "HireTxnStatus" NOT NULL DEFAULT 'posted',
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadataJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "EmailOtp_email_purpose_createdAt_idx" ON "EmailOtp"("email", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_status_idx" ON "Session"("userId", "status");

-- CreateIndex
CREATE INDEX "Session_family_status_idx" ON "Session"("family", "status");

-- CreateIndex
CREATE INDEX "ConsentLog_userId_consentType_acceptedAt_idx" ON "ConsentLog"("userId", "consentType", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSecret_userId_provider_key" ON "UserSecret"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AutoApplyJob_idempotencyKey_key" ON "AutoApplyJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutoApplyJob_userId_status_createdAt_idx" ON "AutoApplyJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AutoApplyJobLog_jobId_createdAt_idx" ON "AutoApplyJobLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Application_userId_submittedAt_idx" ON "Application"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "Application_jobId_submittedAt_idx" ON "Application"("jobId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_eventId_key" ON "PaymentEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "HireTransaction_idempotencyKey_key" ON "HireTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HireTransaction_userId_createdAt_idx" ON "HireTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HireTransaction_type_createdAt_idx" ON "HireTransaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecret" ADD CONSTRAINT "UserSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApplyJob" ADD CONSTRAINT "AutoApplyJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApplyJobLog" ADD CONSTRAINT "AutoApplyJobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutoApplyJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutoApplyJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireTransaction" ADD CONSTRAINT "HireTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

