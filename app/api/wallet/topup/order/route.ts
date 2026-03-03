import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { getRazorpayClient } from "src/lib/billing";
import { prisma } from "src/lib/prisma";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";
import { hiresFromRupees, MIN_TOPUP_RUPEES } from "src/lib/hires";

const topupOrderSchema = z.object({
  rupees: z.number().int().min(MIN_TOPUP_RUPEES).max(200000),
});

export async function POST(req: NextRequest) {
  try {
    const rl = enforceRateLimit({
      key: rateLimitKey(req, "wallet.topup_order"),
      limit: 12,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot top up Hires", 400, "INVALID_ACTOR");
    }

    const body = topupOrderSchema.parse(await req.json());
    const rupees = body.rupees;
    const hires = hiresFromRupees(rupees);
    const amountPaise = rupees * 100;
    const idempotencyKey = (req.headers.get("x-idempotency-key") || "").trim();

    if (idempotencyKey) {
      const eventId = `wallet_order_intent:${authResult.auth.user.id}:${idempotencyKey}`;
      const existing = await prisma.paymentEvent.findUnique({ where: { eventId } });
      if (existing) {
        const payload = existing.payload as Prisma.JsonObject | null;
        const data = payload?.orderData as Prisma.JsonObject | undefined;
        if (data) return ok("Order already created", data as unknown as Record<string, unknown>);
      }
    }

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `cp_hires_${Date.now()}`,
      notes: {
        userId: authResult.auth.user.id,
        userEmail: authResult.auth.user.email,
        rupees: String(rupees),
        hires: String(hires),
        mode: "wallet_topup",
      },
    });

    const orderData = {
      provider: "razorpay",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      rupees,
      hires,
      keyId: process.env.RZP_KEY_ID || "",
      minTopupRupees: MIN_TOPUP_RUPEES,
      conversion: "1 INR = 1 Hire",
    };

    if (idempotencyKey) {
      const eventId = `wallet_order_intent:${authResult.auth.user.id}:${idempotencyKey}`;
      await prisma.paymentEvent.upsert({
        where: { eventId },
        create: {
          provider: "razorpay",
          eventId,
          eventType: "wallet.order.created",
          payload: { orderData } as Prisma.InputJsonValue,
          processedAt: new Date(),
        },
        update: {
          payload: { orderData } as Prisma.InputJsonValue,
          processedAt: new Date(),
        },
      });
    }

    return ok("Top-up order created", orderData);
  } catch (error) {
    return handleApiError(error, "Failed to create top-up order");
  }
}
