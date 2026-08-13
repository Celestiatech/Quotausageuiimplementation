import { NextRequest } from "next/server";
import { requireExtAuth, chargeHireForAnswer } from "src/lib/v1";
import { streamCopilotChat, copilotStreamResponse, copilotErrorResponse, getCopilotConfig } from "src/lib/copilot";
import { fail } from "src/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireExtAuth();
  if ("error" in auth) return auth.error;

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data", 400, "VALIDATION_ERROR");

  const file = form.get("file");
  const language = String(form.get("programmingLanguage") || "").trim().slice(0, 100);
  if (!(file instanceof File)) return fail("file is required", 400, "VALIDATION_ERROR");

  const config = getCopilotConfig();
  if (!config.apiKey) return fail("AI provider is not configured", 503, "FEATURE_DISABLED");

  const chargeError = await chargeHireForAnswer(auth.auth.user.id, "upload-file");
  if (chargeError) return chargeError;

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/png";
  const image = `data:${mime};base64,${buf.toString("base64")}`;

  const messages = [
    {
      role: "system",
      content:
        "You are an expert coding interview assistant. Analyze the uploaded screenshot of the coding problem and help the candidate. Explain the approach, then give the solution with clear code. Use markdown for code blocks.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: language
            ? `Solve the coding problem shown in this screenshot. The candidate's selected programming language is ${language}.`
            : "Solve the coding problem shown in this screenshot.",
        },
        { type: "image_url", image_url: { url: image } },
      ],
    },
  ];

  try {
    const { stream } = await streamCopilotChat({ config, messages, maxTokens: 2000, model: config.visionModel });
    return copilotStreamResponse(stream);
  } catch (error) {
    return copilotErrorResponse(error);
  }
}
