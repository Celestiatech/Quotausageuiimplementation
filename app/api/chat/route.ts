import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatAction = { label: string; href: string };

function getEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function suggestActions(latestUserText: string): ChatAction[] {
  const t = latestUserText.toLowerCase();
  const actions: ChatAction[] = [];
  const add = (label: string, href: string) => actions.push({ label, href });

  if (t.includes("sign up") || t.includes("signup") || t.includes("register") || t.includes("create account")) add("Open Signup", "/signup");
  if (t.includes("login") || t.includes("sign in")) add("Open Login", "/login");
  if (t.includes("otp") || t.includes("verify") || t.includes("code")) add("Resend OTP", "/signup");
  if (t.includes("price") || t.includes("pricing") || t.includes("plan") || t.includes("pro")) add("View Pricing", "/pricing");
  if (t.includes("billing") || t.includes("pay") || t.includes("purchase") || t.includes("top up") || t.includes("wallet")) add("Open Billing", "/dashboard/billing");
  if (t.includes("quota") || t.includes("limit") || t.includes("daily cap")) add("View Dashboard", "/dashboard");
  if (t.includes("hire") || t.includes("coins") || t.includes("credits")) add("Hires Wallet", "/dashboard/billing");
  if (t.includes("privacy")) add("Privacy Policy", "/privacy-policy");
  if (t.includes("terms")) add("Terms", "/terms-of-service");
  if (t.includes("cookie")) add("Cookie Policy", "/cookie-policy");

  // Dedupe by href+label
  const seen = new Set<string>();
  return actions.filter((a) => {
    const k = `${a.label}|${a.href}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildAssistantInstructions() {
  return [
    "You are the AutoApply CV website assistant.",
    "Help users with signup/OTP, login, dashboard usage, quota/hires, pricing, billing/checkout, and troubleshooting.",
    "Be concise and action-oriented; ask one clarifying question when needed.",
    "If the user asks for credentials/OTPs/passwords, refuse and provide safe guidance.",
    "",
    "Known product facts (use these when relevant):",
    "- Site name: AutoApply CV (autoapplycv.in).",
    "- Signup includes a free bonus of 300 Hires coins (wallet credit).",
    "- Free plan has a daily apply/quota limit configured server-side.",
    "- Pro plan is intended to be effectively unlimited.",
    "- Cookie consent banner exists; tracking may depend on consent settings.",
    "",
    "Support guidance:",
    "- For OTP issues: verify email, resend OTP, check spam/junk, try again after a minute.",
    "- For billing: explain that checkout may redirect and that webhooks can take a short time to sync.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv("OPENAI_API_KEY");
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "Chatbot is not configured (OPENAI_API_KEY missing)." },
        { status: 501 }
      );
    }

    const body = (await req.json()) as { messages?: ChatMessage[] };
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = rawMessages
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .slice(-20)
      .map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, 8000),
      }));
    const latestUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const actions = suggestActions(latestUser);

    const model = getEnv("OPENAI_MODEL") || "gpt-4.1-mini";
    const instructions = buildAssistantInstructions();

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions,
        input: messages.map((m) => ({
          role: m.role,
          content: [{ type: "input_text", text: m.content }],
        })),
        max_output_tokens: 400,
      }),
    });

    const json = (await upstream.json()) as { output_text?: string; error?: { message?: string } };
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, message: json?.error?.message || "Chat provider error" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      reply: String(json.output_text || "").trim(),
      actions,
    });
  } catch (error) {
    console.error("chat error:", error);
    return NextResponse.json({ success: false, message: "Chat failed" }, { status: 500 });
  }
}
