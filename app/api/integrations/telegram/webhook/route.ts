import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { verifyTelegramWebhookSecret } from "src/lib/telegram";

type TelegramUpdate = {
  message?: {
    text?: string;
  };
  edited_message?: {
    text?: string;
  };
  channel_post?: {
    text?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const verified = verifyTelegramWebhookSecret(req);
    if (!verified.ok) return verified.error;

    const body = (await req.json()) as TelegramUpdate;
    const text = String(body?.message?.text || body?.edited_message?.text || body?.channel_post?.text || "").trim();
    if (!text) return ok("Ignored", {});

    // Admin reply format: /reply <conversationId> <message>
    const normalized = text.replace(/^\/reply@\S+\s+/i, "/reply ");
    if (!normalized.toLowerCase().startsWith("/reply ")) {
      return ok("Ignored", {});
    }
    const rest = normalized.slice(7).trim();
    const firstSpace = rest.indexOf(" ");
    if (firstSpace === -1) return ok("Ignored", {});
    const conversationId = rest.slice(0, firstSpace).trim();
    const message = rest.slice(firstSpace + 1).trim();
    if (!conversationId || !message) return ok("Ignored", {});

    const convo = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true },
    });
    if (!convo || convo.status !== "open") return ok("Ignored", {});

    const created = await prisma.supportMessage.create({
      data: { conversationId, sender: "admin", content: message.slice(0, 4000) },
      select: { id: true },
    });

    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { messageId: created.id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return NextResponse.json({ success: true, data: { ignored: true } });
    }
    return handleApiError(error, "Failed to process Telegram webhook");
  }
}
