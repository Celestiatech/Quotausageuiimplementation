import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { consentSchema } from "src/lib/schemas";
import { writeAuditLog } from "src/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = consentSchema.parse(await req.json());

    const consent = await prisma.consentLog.create({
      data: {
        userId: authResult.auth.user.id,
        consentType: payload.consentType,
        version: payload.version,
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "user.consent_given",
      targetType: "consent",
      targetId: consent.id,
      metadataJson: payload,
    });

    return ok("Consent recorded", { consent });
  } catch (error) {
    return handleApiError(error, "Failed to record consent");
  }
}
