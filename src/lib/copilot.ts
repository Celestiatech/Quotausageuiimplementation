import { NextResponse } from "next/server";

function getEnv(name: string) {
  return String(process.env[name] || "").trim();
}

type CopilotProvider = "openai" | "groq" | "custom";

export type CopilotConfig = {
  provider: CopilotProvider;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
};

export function getCopilotConfig(): CopilotConfig {
  const provider = (getEnv("INTERVIEW_ASSIST_PROVIDER") || "groq").toLowerCase() as CopilotProvider;
  const explicitKey = getEnv("INTERVIEW_ASSIST_API_KEY");
  if (provider === "openai") {
    return {
      provider,
      apiKey: explicitKey || getEnv("OPENAI_API_KEY"),
      baseUrl: getEnv("INTERVIEW_ASSIST_BASE_URL") || "https://api.openai.com/v1/chat/completions",
      chatModel: getEnv("INTERVIEW_ASSIST_MODEL") || getEnv("OPENAI_MODEL") || "gpt-4.1-mini",
      visionModel: getEnv("INTERVIEW_ASSIST_VISION_MODEL") || getEnv("OPENAI_MODEL") || "gpt-4.1-mini",
    };
  }
  if (provider === "custom") {
    return {
      provider,
      apiKey: explicitKey || getEnv("GROQ_API_KEY"),
      baseUrl: getEnv("INTERVIEW_ASSIST_BASE_URL") || "https://api.groq.com/openai/v1/chat/completions",
      chatModel: getEnv("INTERVIEW_ASSIST_MODEL") || "llama-3.3-70b-versatile",
      visionModel: getEnv("INTERVIEW_ASSIST_VISION_MODEL") || "llama-3.2-90b-vision-preview",
    };
  }
  return {
    provider: "groq",
    apiKey: explicitKey || getEnv("GROQ_API_KEY"),
    baseUrl: getEnv("INTERVIEW_ASSIST_BASE_URL") || "https://api.groq.com/openai/v1/chat/completions",
    chatModel: getEnv("INTERVIEW_ASSIST_MODEL") || "llama-3.3-70b-versatile",
    visionModel: getEnv("INTERVIEW_ASSIST_VISION_MODEL") || "llama-3.2-90b-vision-preview",
  };
}

export class CopilotMissingKeyError extends Error {
  constructor() {
    super("AI provider is not configured");
  }
}

export class CopilotProviderError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`AI provider error (${status}): ${body.slice(0, 400)}`);
    this.status = status;
  }
}

export type CopilotChatMessage = {
  role: string;
  content: unknown;
};

// Converts an upstream SSE stream (data: {...} lines) into a plain-text byte
// stream. The Interview Copilot extension reads the raw body and appends each
// decoded chunk to the transcript, so the response must be plain text.
function sseToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (buffer.indexOf("\n") === -1) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
        }
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              controller.enqueue(encoder.encode(delta));
            }
          } catch {
            // Skip malformed SSE lines.
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}

export async function streamCopilotChat(opts: {
  config?: CopilotConfig;
  messages: CopilotChatMessage[];
  maxTokens: number;
  model?: string;
  temperature?: number;
}): Promise<{ stream: ReadableStream<Uint8Array>; model: string }> {
  const config = opts.config ?? getCopilotConfig();
  if (!config.apiKey) throw new CopilotMissingKeyError();

  const model = opts.model || config.chatModel;
  const res = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens,
      stream: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new CopilotProviderError(res.status, body);
  }
  if (!res.body) throw new CopilotProviderError(502, "Empty provider response body");
  return { stream: sseToTextStream(res.body), model };
}

export function copilotStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

export function copilotErrorResponse(error: unknown, fallback = "Failed to generate response") {
  if (error instanceof CopilotMissingKeyError) {
    return NextResponse.json(
      { success: false, message: "AI provider is not configured" },
      { status: 503 }
    );
  }
  if (error instanceof CopilotProviderError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status === 429 ? 429 : 502 }
    );
  }
  console.error("[copilot]", error);
  return NextResponse.json({ success: false, message: fallback }, { status: 500 });
}
