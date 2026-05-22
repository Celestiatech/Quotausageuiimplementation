"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatAction = { label: string; href: string };

function clampText(value: unknown, maxLen: number) {
  const text = String(value ?? "");
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

export default function ChatWidget() {
  const enabled = useMemo(() => {
    // Enable by default in dev; can be disabled via env in prod.
    const flag = String(process.env.NEXT_PUBLIC_CHATBOT_ENABLED || "").trim().toLowerCase();
    if (flag === "0" || flag === "false" || flag === "no") return false;
    return true;
  }, []);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [actions, setActions] = useState<ChatAction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I’m here to help with signup/OTP, dashboard, pricing, billing, and anything else. What do you need?",
    },
  ]);
  const [error, setError] = useState<string>("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const title = String(process.env.NEXT_PUBLIC_CHATBOT_TITLE || "Ask me").trim();
  const position = String(process.env.NEXT_PUBLIC_CHATBOT_POSITION || "bottom-right").trim();
  const primary = String(process.env.NEXT_PUBLIC_CHATBOT_PRIMARY || "").trim() || "#6366F1";
  const accent = String(process.env.NEXT_PUBLIC_CHATBOT_ACCENT || "").trim() || "#A855F7";
  const debug = String(process.env.NEXT_PUBLIC_CHATBOT_DEBUG || "").trim().toLowerCase() === "true";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.log("[ChatWidget] mounted", { enabled, position, title, primary, accent });
  }, [accent, debug, enabled, position, primary, title]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  if (!enabled) return null;
  if (!mounted) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError("");
    setInput("");
    setActions([]);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: clampText(text, 4000) }];
    setMessages(nextMessages);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; reply?: string; actions?: ChatAction[] };
      if (!res.ok || !data?.reply) {
        throw new Error(data?.message || "Chat failed");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: String(data.reply) }]);
      setActions(Array.isArray(data.actions) ? data.actions.slice(0, 4) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I couldn’t respond right now. Please try again in a moment, or email support if it keeps happening.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className={position === "bottom-left" ? "cp-chat-widget cp-chat-widget--left" : "cp-chat-widget"}
      data-cp-chat-widget="1"
      style={
        {
          ["--cp-chat-primary" as never]: primary,
          ["--cp-chat-accent" as never]: accent,
          outline: debug ? "2px solid rgba(168,85,247,0.8)" : undefined,
        } as React.CSSProperties
      }
    >
      {debug ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -6,
            left: -6,
            width: 12,
            height: 12,
            borderRadius: 9999,
            background: "red",
          }}
          title="ChatWidget debug beacon"
        />
      ) : null}
      {open ? (
        <div className="w-[340px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div
            className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-white"
            style={{
              background: "linear-gradient(90deg, var(--cp-chat-primary), var(--cp-chat-accent))",
            }}
          >
            <div className="text-sm font-semibold">{title}</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-white/10 px-2 py-1 text-sm font-semibold text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>

          <div ref={listRef} className="max-h-[360px] space-y-3 overflow-auto px-4 py-3">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl bg-black px-3 py-2 text-sm text-white"
                      : "max-w-[85%] rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-900"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 px-3 py-3">
            {error ? <div className="mb-2 text-xs text-red-600">{error}</div> : null}
            {actions.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <a
                    key={`${a.href}:${a.label}`}
                    href={a.href}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    {a.label}
                  </a>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="Type a message…"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-300"
                disabled={busy}
              />
              <button
                type="button"
                onClick={send}
                disabled={busy || !input.trim()}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{
                  background: "linear-gradient(90deg, var(--cp-chat-primary), var(--cp-chat-accent))",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full px-4 py-3 text-sm font-semibold text-white shadow-xl"
          style={{
            background: "linear-gradient(90deg, var(--cp-chat-primary), var(--cp-chat-accent))",
          }}
        >
          {title}
        </button>
      )}
    </div>,
    document.body
  );
}
