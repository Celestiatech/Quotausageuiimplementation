import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { encryptText } from "src/lib/security";
import { handleApiError, ok } from "src/lib/api";
import { requireAuth } from "src/lib/guards";
import { writeAuditLog } from "src/lib/audit";

const schema = z.object({
  username: z.string().trim().min(3).max(200),
  password: z.string().min(3).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const payload = schema.parse(await req.json());
    const encryptedValue = encryptText(JSON.stringify(payload));

    await prisma.userSecret.upsert({
      where: {
        userId_provider: {
          userId: authResult.auth.user.id,
          provider: "linkedin",
        },
      },
      create: {
        userId: authResult.auth.user.id,
        provider: "linkedin",
        encryptedValue,
        keyVersion: 1,
      },
      update: {
        encryptedValue,
        keyVersion: 1,
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "user.linkedin_secret_updated",
      targetType: "user_secret",
      metadataJson: { provider: "linkedin" },
    });

    return ok("LinkedIn credentials saved");
  } catch (error) {
    return handleApiError(error, "Failed to save LinkedIn credentials");
  }
}
