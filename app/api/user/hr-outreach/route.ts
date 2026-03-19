import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";
import { sendMail } from "src/lib/mail";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/hr-outreach
 *
 * Send a direct outreach email to an HR contact.
 *
 * Body:
 *   to      – recipient email
 *   name    – recipient name (for logging)
 *   company – company name (for logging)
 *   subject – email subject line
 *   body    – plain-text email body
 *
 * Returns: { success: true, messageId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const data = (await req.json()) as {
      to?: string;
      name?: string;
      company?: string;
      subject?: string;
      body?: string;
    };

    const { to, name, company, subject, body } = data;

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "to, subject and body are required" },
        { status: 400 }
      );
    }

    // Validate email address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Convert plain-text body to HTML (preserve newlines)
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; font-size: 15px; line-height: 1.7; color: #222; }
    p { margin: 0 0 12px; }
  </style>
</head>
<body>
  ${body
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("")}
</body>
</html>`;

    const result = await sendMail({
      to,
      subject,
      html: htmlBody,
      text: body,
      template: "hr_outreach",
    });

    console.info(
      `[hr-outreach] Email sent by user=${userId} to=${to} company=${company || "?"} name=${name || "?"} messageId=${result?.messageId}`
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
