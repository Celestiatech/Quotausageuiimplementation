import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";
import { sendMail } from "src/lib/mail";
import { prisma } from "src/lib/prisma";
import { consumeHiresForApplies } from "src/lib/hires";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/hr-outreach
 *
 * Send a direct outreach email to an HR contact.
 * By default charges 1 Hire per email. Pass test=true to skip charge.
 *
 * Body (JSON):
 *   to      – recipient email
 *   name    – recipient name (for logging)
 *   company – company name (for logging)
 *   subject – email subject line
 *   body    – plain-text email body
 *   test    – if true, skip hire charge
 *
 * Returns: { success: true, messageId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;
    const userEmail = authResult.auth.user.email;

    const contentType = req.headers.get("content-type") || "";

    let to = "", name = "", company = "", subject = "", body = "", test = "false";

    {
      const data = (await req.json()) as {
        to?: string;
        name?: string;
        company?: string;
        subject?: string;
        body?: string;
        test?: string;
      };
      to = data.to || "";
      name = data.name || "";
      company = data.company || "";
      subject = data.subject || "";
      body = data.body || "";
      test = data.test || "false";
    }

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "to, subject and body are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (test !== "true") {
      // Consume 1 Hire from wallet
      const debit = await consumeHiresForApplies({
        userId,
        count: 1,
        referenceType: "hr_outreach_email",
        referenceId: `email_${Date.now()}`,
        idempotencyPrefix: `hr_email_${userId}_${Date.now()}`,
      });
      if (!debit.ok) {
        return NextResponse.json(
          { error: "Insufficient Hires. Please top up your wallet." },
          { status: 402 }
        );
      }
    }

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#1f2937;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 0 24px;">
            ${body
              .split("\n")
              .map((line) => `<p style="margin:0 0 12px;">${line || "&nbsp;"}</p>`)
              .join("")}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const mailOptions: Parameters<typeof sendMail>[0] = {
      to,
      subject,
      html: htmlBody,
      text: body,
      template: "hr_outreach",
      replyTo: userEmail,
    };
    const result = await sendMail(mailOptions);

    // Log email with userId
    await prisma.emailLog.create({
      data: {
        toEmail: to,
        subject,
        template: "hr_outreach",
        status: "sent",
        providerMessageId: result?.messageId || null,
      },
    });

    console.info(
      `[hr-outreach] Email sent by user=${userId} to=${to} company=${company || "?"} name=${name || "?"} test=${test} hires=${test === "true" ? 0 : 1} messageId=${result?.messageId}`
    );

    return NextResponse.json(
      { success: true, messageId: result?.messageId },
      { status: 200 }
    );
  } catch (error) {
    console.error("[hr-outreach] Send error:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
