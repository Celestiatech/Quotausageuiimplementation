import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function writeAuditLog(input: {
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadataJson?: Prisma.InputJsonValue;
}) {
  const h = await headers();
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadataJson: input.metadataJson,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
      userAgent: h.get("user-agent") || undefined,
    },
  });
}
