import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "src/lib/guards";
import { prisma } from "src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const contacts = await prisma.hROutreachContact.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contacts });
  } catch (err) {
    console.error("GET /hr-outreach/contacts error:", err);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const userId = authResult.auth.user.id;

    const body = (await req.json()) as { contacts?: any[] };
    const incoming = body.contacts || [];

    // Replace all contacts for this user
    await prisma.$transaction(async (tx) => {
      await tx.hROutreachContact.deleteMany({ where: { userId } });

      if (incoming.length > 0) {
        await tx.hROutreachContact.createMany({
          data: incoming.map((c) => ({
            userId,
            name: c.name || "",
            title: c.title || "",
            company: c.company || "",
            email: c.email || "",
            phone: c.phone || "",
            linkedinUrl: c.linkedinUrl || "",
            source: c.source || "web",
            jobType: c.jobType || "",
            searchKeyword: c.searchKeyword || "",
            searchDate: c.searchDate || "",
            notes: c.notes || "",
          })),
        });
      }
    });

    return NextResponse.json({ success: true, count: incoming.length });
  } catch (err) {
    console.error("POST /hr-outreach/contacts error:", err);
    return NextResponse.json({ error: "Failed to save contacts" }, { status: 500 });
  }
}
