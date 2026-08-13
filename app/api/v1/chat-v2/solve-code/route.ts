import { NextRequest } from "next/server";
import { requireExtAuth, clampInt, chargeHireForAnswer } from "src/lib/v1";
import { streamCopilotChat, copilotStreamResponse, copilotErrorResponse, getCopilotConfig } from "src/lib/copilot";
import { fail } from "src/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireExtAuth();
  if ("error" in auth) return auth.error;

  let body: { codeContext?: unknown; userQuery?: unknown; max_tokens?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400, "VALIDATION_ERROR");
  }

  const codeContext = String(body.codeContext || "").slice(0, 40000);
  const userQuery = String(body.userQuery || "").trim().slice(0, 4000);
  if (!userQuery) return fail("userQuery is required", 400, "VALIDATION_ERROR");
  const maxTokens = clampInt(body.max_tokens, 1, 4096, 2000);

  const config = getCopilotConfig();
  if (!config.apiKey) return fail("AI provider is not configured", 503, "FEATURE_DISABLED");

  const chargeError = await chargeHireForAnswer(auth.auth.user.id, "solve-code");
  if (chargeError) return chargeError;

  const messages = [
    {
      role: "system",
      content:
        "You are an expert coding interview assistant. Help the candidate solve the problem step by step. Be concise but complete: explain the approach, then give the solution with clear code. Use markdown for code blocks.",
    },
    {
      role: "user",
      content: `Code context:\n${codeContext || "(no code provided)"}\n\nQuestion:\n${userQuery}`,
    },
  ];

  try {
    const { stream } = await streamCopilotChat({ config, messages, maxTokens });
    return copilotStreamResponse(stream);
  } catch (error) {
    return copilotErrorResponse(error);
  }
}
