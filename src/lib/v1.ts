import { randomUUID } from "crypto";
import { requireAuth } from "./guards";
import type { CopilotChatMessage } from "./copilot";
import { consumeHiresForInterview } from "./hires";
import { fail } from "./api";

export async function requireExtAuth() {
  const result = await requireAuth();
  if ("error" in result) return { error: result.error } as const;
  return { auth: result.auth } as const;
}

// The Interview Copilot charges 1 Hire per generated answer. Returns an error
// response when the user is out of Hires, otherwise null.
export async function chargeHireForAnswer(userId: string, referenceId: string) {
  const result = await consumeHiresForInterview({
    userId,
    count: 1,
    referenceId,
    idempotencyKey: `interview:${userId}:${randomUUID()}`,
    metadataJson: { context: referenceId },
  });
  if (!result.ok) {
    return fail("You're out of Hires. Add more Hires or upgrade your plan to keep using the Interview Copilot.", 402, "INSUFFICIENT_HIRES");
  }
  return null;
}

export function sanitizeMessages(raw: unknown): CopilotChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: CopilotChatMessage[] = [];
  for (const item of raw.slice(0, 60)) {
    if (typeof item !== "object" || item === null) continue;
    const m = item as { role?: unknown; content?: unknown };
    const role = String(m.role || "user");
    if (role !== "system" && role !== "user" && role !== "assistant") continue;
    const content = m.content;
    if (typeof content !== "string" || !content.trim()) continue;
    out.push({ role, content: content.slice(0, 32000) });
  }
  return out;
}

export function normalizeBase64Image(raw: string, mime = "image/jpeg") {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image")) return trimmed;
  return `data:${mime};base64,${trimmed}`;
}

export function clampInt(raw: unknown, min: number, max: number, fallback: number) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
