import { NextResponse } from "next/server";
import { requireExtAuth } from "src/lib/v1";

export async function GET() {
  const auth = await requireExtAuth();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ success: true, message: "Token verified" });
}
