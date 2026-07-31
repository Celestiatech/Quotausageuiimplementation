import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/email-templates
 *
 * Fetch email templates for the current user (user-owned + global templates).
 *
 * Returns: { templates: EmailTemplate[] }
 */
export async function GET(_req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const templates = await prisma.emailTemplate.findMany({
      where: {
        OR: [{ userId }, { isGlobal: true }],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    console.error("[email-templates] Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

/**
 * POST /api/user/email-templates
 *
 * Create a new email template for the current user.
 *
 * Body:
 *   name        – template display name
 *   subject     – default subject line
 *   htmlContent – HTML body (optional)
 *   textContent – plain-text body
 *   category    – template category (optional)
 *
 * Returns: { template: EmailTemplate }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const data = (await req.json()) as {
      name?: string;
      subject?: string;
      htmlContent?: string;
      textContent?: string;
      category?: string;
    };

    const { name, subject, htmlContent, textContent, category } = data;

    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "name, subject and htmlContent are required" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        userId,
        name,
        subject,
        htmlContent,
        textContent: textContent || "",
        category: category || "custom",
        isGlobal: false,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[email-templates] Create error:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
