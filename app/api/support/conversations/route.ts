import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ok, fail, handleApiError } from "src/lib/api";
import { getAuthUserFromRequest } from "src/lib/auth";
import { prisma } from "src/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { visitorId?: string };
    const visitorId = String(body?.visitorId || "").trim();
    if (!visitorId) return fail("visitorId required", 400, "VALIDATION_ERROR");

    const auth = await getAuthUserFromRequest();

    const existing = await prisma.supportConversation.findFirst({
      where: { visitorId, status: "open" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (existing) return ok("Conversation fetched", { conversationId: existing.id });

    const created = await prisma.supportConversation.create({
      data: {
        visitorId,
        userId: auth?.user?.id || null,
        status: "open",
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });

    return ok("Conversation created", { conversationId: created.id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return NextResponse.json(
        { success: false, message: "Support chat is not initialized. Run database migrations.", code: "SERVICE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    return handleApiError(error, "Failed to create conversation");
  }
}

