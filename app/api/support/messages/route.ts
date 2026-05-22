import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { sendTelegramNotification } from "src/lib/telegram";

export async function GET(req: NextRequest) {
  try {
    const conversationId = String(req.nextUrl.searchParams.get("conversationId") || "").trim();
    if (!conversationId) return fail("conversationId required", 400, "VALIDATION_ERROR");
    const after = String(req.nextUrl.searchParams.get("after") || "").trim();

    const afterDate = after ? new Date(after) : null;
    const where = {
      conversationId,
      ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
    };

    const messages = await prisma.supportMessage.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, sender: true, content: true, createdAt: true },
    });
    return ok("Messages fetched", { messages });
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
    return handleApiError(error, "Failed to fetch messages");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      conversationId?: string;
      visitorId?: string;
      content?: string;
      agentName?: string;
    };
    const conversationId = String(body?.conversationId || "").trim();
    const visitorId = String(body?.visitorId || "").trim();
    const content = String(body?.content || "").trim();
    const agentName = String(body?.agentName || "").trim();
    if (!conversationId || !visitorId || !content) return fail("Invalid message", 400, "VALIDATION_ERROR");

    const convo = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, visitorId: true, status: true },
    });
    if (!convo || convo.visitorId !== visitorId) return fail("Not found", 404, "NOT_FOUND");
    if (convo.status !== "open") return fail("Conversation closed", 400, "CONVERSATION_CLOSED");

    const created = await prisma.supportMessage.create({
      data: { conversationId, sender: "visitor", content: content.slice(0, 4000) },
      select: { id: true, sender: true, content: true, createdAt: true },
    });
    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: created.createdAt },
    });

    // Notify admin via Telegram (best-effort, non-blocking).
    void sendTelegramNotification(
      [
        "<b>New website message</b>",
        `Conversation: <code>${conversationId}</code>`,
        agentName ? `Agent: <b>${agentName.slice(0, 40)}</b>` : null,
        "",
        `<b>Message:</b> ${content.slice(0, 800)}`,
        "",
        `Reply from Telegram: <code>/reply ${conversationId} your message</code>`,
      ]
        .filter(Boolean)
        .join("\n")
    ).then((result) => {
      if (result.ok) return;
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[Support] Telegram notification not delivered", result);
      }
    });

    return ok("Message sent", { message: created });
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
    return handleApiError(error, "Failed to send message");
  }
}
