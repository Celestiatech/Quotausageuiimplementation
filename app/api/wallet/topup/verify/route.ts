import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { verifyRazorpayOrderPaymentSignature, getRazorpayClient } from "src/lib/billing";
import { creditHires, getWalletSummary } from "src/lib/hires";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "wallet.topup_verify"),
      limit: 20,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot top up Hires", 400, "INVALID_ACTOR");
    }

    const body = verifySchema.parse(await req.json());
    const valid = verifyRazorpayOrderPaymentSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (!valid) return fail("Invalid Razorpay signature", 401, "INVALID_SIGNATURE");

    const processedEvent = await prisma.paymentEvent.findUnique({
      where: { eventId: body.razorpay_payment_id },
    });
    if (processedEvent) {
      const wallet = await getWalletSummary(authResult.auth.user.id);
      return ok("Payment already processed", {
        paymentId: body.razorpay_payment_id,
        hireBalance: wallet.user.hireBalance,
      });
    }

    const razorpay = getRazorpayClient();
    const [payment, order] = await Promise.all([
      razorpay.payments.fetch(body.razorpay_payment_id),
      razorpay.orders.fetch(body.razorpay_order_id),
    ]);
    const paymentJson = JSON.parse(JSON.stringify(payment)) as Prisma.InputJsonValue;

    const notes = (order.notes || {}) as Record<string, string>;
    const orderUserId = notes.userId || "";
    if (orderUserId && orderUserId !== authResult.auth.user.id) {
      return fail("Order does not belong to current user", 403, "FORBIDDEN");
    }
    const hires = Number(notes.hires || Math.floor((Number(order.amount) || 0) / 100));
    if (!Number.isFinite(hires) || hires <= 0) {
      return fail("Invalid top-up amount", 400, "INVALID_TOPUP");
    }

    const topupTxn = await creditHires({
      userId: authResult.auth.user.id,
      hires: Math.floor(hires),
      referenceType: "razorpay_payment",
      referenceId: body.razorpay_payment_id,
      idempotencyKey: `wallet_topup:${body.razorpay_payment_id}`,
      metadataJson: {
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
      } as Prisma.InputJsonValue,
    });

    await prisma.paymentEvent.create({
      data: {
        provider: "razorpay",
        eventId: body.razorpay_payment_id,
        eventType: "wallet.topup.paid",
        payload: {
          orderId: body.razorpay_order_id,
          paymentId: body.razorpay_payment_id,
          signature: body.razorpay_signature,
          payment: paymentJson,
          hires,
          topupTxnId: topupTxn.id,
        } as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });

    const wallet = await getWalletSummary(authResult.auth.user.id);
    return ok("Top-up verified and Hires credited", {
      paymentId: body.razorpay_payment_id,
      orderId: body.razorpay_order_id,
      creditedHires: hires,
      hireBalance: wallet.user.hireBalance,
      dailyRemaining: wallet.dailyRemaining,
      spendable: wallet.spendable,
    });
  } catch (error) {
    return handleApiError(error, "Failed to verify top-up payment");
  }
}
