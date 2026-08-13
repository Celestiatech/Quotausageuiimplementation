import { NextRequest } from "next/server";
import { requireExtAuth, sanitizeMessages, clampInt, chargeHireForAnswer } from "src/lib/v1";
import { streamCopilotChat, copilotStreamResponse, copilotErrorResponse, getCopilotConfig } from "src/lib/copilot";
import { fail } from "src/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireExtAuth();
  if ("error" in auth) return auth.error;

  let body: { messages?: unknown; max_tokens?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400, "VALIDATION_ERROR");
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages.length) return fail("messages are required", 400, "VALIDATION_ERROR");
  const maxTokens = clampInt(body.max_tokens, 1, 4096, 1000);

  const config = getCopilotConfig();
  if (!config.apiKey) return fail("AI provider is not configured", 503, "FEATURE_DISABLED");

  const chargeError = await chargeHireForAnswer(auth.auth.user.id, "chat-v2");
  if (chargeError) return chargeError;

  try {
    const { stream } = await streamCopilotChat({ config, messages, maxTokens });
    return copilotStreamResponse(stream);
  } catch (error) {
    return copilotErrorResponse(error);
  }
}
