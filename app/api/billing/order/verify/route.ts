import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { verifyRazorpayOrderPaymentSignature, getRazorpayClient } from "src/lib/billing";
import { getPlanQuota } from "src/lib/quota";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

const verifyOrderSchema = z.object({
  plan: z.enum(["pro", "coach"]),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const rl = enforceRateLimit({
      key: rateLimitKey(req, "billing.order_verify"),
      limit: 15,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.user.role === "admin") {
      return fail("Admins cannot purchase plans", 400, "INVALID_ACTOR");
    }

    const body = verifyOrderSchema.parse(await req.json());
    const valid = verifyRazorpayOrderPaymentSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (!valid) return fail("Invalid Razorpay signature", 401, "INVALID_SIGNATURE");

    const existing = await prisma.paymentEvent.findUnique({
      where: { eventId: body.razorpay_payment_id },
    });
    if (existing) {
      return ok("Payment already processed", { paymentId: body.razorpay_payment_id });
    }

    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(body.razorpay_payment_id);
    const serializablePayment = JSON.parse(JSON.stringify(payment)) as Prisma.InputJsonValue;

    const now = new Date();
    const nextPeriod = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.paymentEvent.create({
      data: {
        provider: "razorpay",
        eventId: body.razorpay_payment_id,
        eventType: "order.paid",
        payload: {
          orderId: body.razorpay_order_id,
          paymentId: body.razorpay_payment_id,
          signature: body.razorpay_signature,
          plan: body.plan,
          payment: serializablePayment,
        } as Prisma.InputJsonValue,
        processedAt: now,
      },
    });

    await prisma.subscription.upsert({
      where: { userId: authResult.auth.user.id },
      create: {
        userId: authResult.auth.user.id,
        provider: "razorpay",
        providerPlanId: `one_time_${body.plan}`,
        status: "active",
        plan: body.plan,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriod,
        cancelAtPeriodEnd: true,
      },
      update: {
        providerPlanId: `one_time_${body.plan}`,
        status: "active",
        plan: body.plan,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriod,
        cancelAtPeriodEnd: true,
      },
    });

    await prisma.user.update({
      where: { id: authResult.auth.user.id },
      data: {
        plan: body.plan,
        quotaTotal: getPlanQuota(body.plan),
      },
    });

    return ok("Payment verified and plan activated", {
      paymentId: body.razorpay_payment_id,
      orderId: body.razorpay_order_id,
      plan: body.plan,
      currentPeriodEnd: nextPeriod.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "Failed to verify order payment");
  }
}
