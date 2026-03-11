CREATE TABLE "SocialIntegration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "publicConfigJson" JSONB,
    "encryptedSecrets" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialIntegration_provider_key" ON "SocialIntegration"("provider");
CREATE INDEX "SocialIntegration_provider_enabled_idx" ON "SocialIntegration"("provider", "enabled");
