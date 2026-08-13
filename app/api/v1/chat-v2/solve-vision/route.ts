import { NextRequest } from "next/server";
import { requireExtAuth, normalizeBase64Image, clampInt, chargeHireForAnswer } from "src/lib/v1";
import { streamCopilotChat, copilotStreamResponse, copilotErrorResponse, getCopilotConfig } from "src/lib/copilot";
import { fail } from "src/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireExtAuth();
  if ("error" in auth) return auth.error;

  let body: { imageBase64?: unknown; userQuery?: unknown; max_tokens?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400, "VALIDATION_ERROR");
  }

  const userQuery = String(body.userQuery || "").trim().slice(0, 4000);
  const image = normalizeBase64Image(String(body.imageBase64 || ""));
  if (!userQuery) return fail("userQuery is required", 400, "VALIDATION_ERROR");
  if (!image) return fail("imageBase64 is required", 400, "VALIDATION_ERROR");
  const maxTokens = clampInt(body.max_tokens, 1, 4096, 2000);

  const config = getCopilotConfig();
  if (!config.apiKey) return fail("AI provider is not configured", 503, "FEATURE_DISABLED");

  const chargeError = await chargeHireForAnswer(auth.auth.user.id, "solve-vision");
  if (chargeError) return chargeError;

  const messages = [
    {
      role: "system",
      content:
        "You are an expert coding interview assistant. Analyze the screenshot of the coding problem and answer the question clearly. If the image shows a problem statement, solve it: explain the approach, then give the solution with clear code. Use markdown for code blocks.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: userQuery },
        { type: "image_url", image_url: { url: image } },
      ],
    },
  ];

  try {
    const { stream } = await streamCopilotChat({ config, messages, maxTokens, model: config.visionModel });
    return copilotStreamResponse(stream);
  } catch (error) {
    return copilotErrorResponse(error);
  }
}
