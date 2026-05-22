"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ChatMessage = {
  id?: string;
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
  const [mode, setMode] = useState<"assistant" | "human">("assistant");
  const [humanAgent, setHumanAgent] = useState<"Aricka" | "Rahul">("Aricka");
  const [conversationId, setConversationId] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [pollAfter, setPollAfter] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I’m here to help with signup/OTP, dashboard, pricing, billing, and auto apply. What do you need?",
    },
  ]);
  const [error, setError] = useState<string>("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const seenSupportMessageIdsRef = useRef<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  const title = String(process.env.NEXT_PUBLIC_CHATBOT_TITLE || "Ask me").trim();
  const position = String(process.env.NEXT_PUBLIC_CHATBOT_POSITION || "bottom-right").trim();
  const primary = String(process.env.NEXT_PUBLIC_CHATBOT_PRIMARY || "").trim() || "#6366F1";
  const accent = String(process.env.NEXT_PUBLIC_CHATBOT_ACCENT || "").trim() || "#A855F7";

  useEffect(() => {
    if (!enabled) return;
    setMounted(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    try {
      const key = "cp_support_visitor_id";
      const existing = String(window.localStorage.getItem(key) || "").trim();
      if (existing) {
        setVisitorId(existing);
        return;
      }
      const next = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(key, next);
      setVisitorId(next);
    } catch {
      // Ignore.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [enabled, messages, open]);

  const ensureConversation = async () => {
    if (conversationId) return conversationId;
    const v = visitorId || `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    if (!visitorId) setVisitorId(v);
    const res = await fetch("/api/support/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId: v }),
    });
    const data = (await res.json()) as { success?: boolean; data?: { conversationId?: string }; message?: string };
    if (!res.ok || !data?.success || !data?.data?.conversationId) {
      throw new Error(data?.message || "Failed to start conversation");
    }
    setConversationId(data.data.conversationId);
    return data.data.conversationId;
  };

  const pollHuman = async (cid: string) => {
    const url = new URL("/api/support/messages", window.location.origin);
    url.searchParams.set("conversationId", cid);
    if (pollAfter) url.searchParams.set("after", pollAfter);
    const res = await fetch(url.toString(), { method: "GET" });
    const data = (await res.json()) as {
      success?: boolean;
      data?: { messages?: Array<{ id: string; sender: string; content: string; createdAt: string }> };
    };
    if (!res.ok || !data?.success) return;
    const incoming = Array.isArray(data?.data?.messages) ? data.data.messages : [];
    if (!incoming.length) return;
    const unseen = incoming.filter((m) => {
      if (!m?.id) return true;
      if (seenSupportMessageIdsRef.current.has(m.id)) return false;
      seenSupportMessageIdsRef.current.add(m.id);
      return true;
    });
    if (!unseen.length) {
      const last = incoming[incoming.length - 1];
      if (last?.createdAt) setPollAfter(String(last.createdAt));
      return;
    }
    const mapped: ChatMessage[] = unseen.map((m) => ({
      id: m.id,
      role: m.sender === "admin" ? "assistant" : "user",
      content: String(m.content || ""),
    }));
    setMessages((prev) => [...prev, ...mapped]);
    const last = unseen[unseen.length - 1];
    if (last?.createdAt) setPollAfter(String(last.createdAt));
  };

  useEffect(() => {
    if (!enabled) return;
    if (!open) return;
    if (mode !== "human") return;
    if (!conversationId) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        await pollHuman(conversationId);
      } catch {
        // Ignore polling errors.
      }
    };
    const id = window.setInterval(() => void tick(), 3000);
    void tick();
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [conversationId, enabled, mode, open, pollAfter]);

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
      if (mode === "human") {
        const cid = await ensureConversation();
        const res = await fetch("/api/support/messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId: cid, visitorId, content: text, agentName: humanAgent }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          message?: string;
          data?: { message?: { id?: string; createdAt?: string } };
        };
        if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to send message");
        const createdAt = String(data?.data?.message?.createdAt || "").trim();
        const createdId = String(data?.data?.message?.id || "").trim();
        if (createdId) seenSupportMessageIdsRef.current.add(createdId);
        if (createdAt) setPollAfter(createdAt);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sent to ${humanAgent}. Reply will appear here.`,
          },
        ]);
      } else {
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            mode === "human"
              ? "I couldn’t send your message to support right now. Please try again in a moment."
              : "I couldn’t respond right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return null;
  if (!mounted) return null;

  return createPortal(
    <div
      className={position === "bottom-left" ? "cp-chat-widget cp-chat-widget--left" : "cp-chat-widget"}
      data-cp-chat-widget="1"
      style={
        {
          ["--cp-chat-primary" as never]: primary,
          ["--cp-chat-accent" as never]: accent,
        } as React.CSSProperties
      }
    >
      {open ? (
        <div className="w-[340px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div
            className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-white"
            style={{
              background: "linear-gradient(90deg, var(--cp-chat-primary), var(--cp-chat-accent))",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="cp-chat-stack h-10 w-10">
                <img
                  src="/bot/staff-1.svg"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                  alt=""
                  className="cp-chat-staff-1 h-10 w-10 rounded-full border border-white/60 object-cover bg-white/20 shadow-sm"
                />
                <img
                  src="/bot/staff-2.svg"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                  alt=""
                  className="cp-chat-staff-2 h-10 w-10 rounded-full border border-white/60 object-cover bg-white/20 shadow-sm"
                />
                <img
                  src="/bot/128660445-eac307db-718e-453b-81c7-30247c5dcac6.gif"
                  alt=""
                  className="cp-chat-bot-avatar h-10 w-10 rounded-full border border-white/90 object-cover bg-white/20 shadow-sm"
                />
                <span
                  className="cp-chat-online-dot h-4.5 w-4.5 rounded-full border-2 border-white bg-emerald-400"
                  aria-hidden="true"
                  title="Online"
                />
              </span>
              <div className="text-sm font-semibold leading-none">{title}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-white/10 px-2 py-1 text-sm font-semibold text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>

          <div
            ref={listRef}
            className="cp-chat-scroll max-h-[360px] space-y-3 overflow-auto px-4 py-3"
            aria-label="Chat messages"
          >
            {messages.map((m, idx) => (
              <div key={m.id || idx} className={m.role === "user" ? "flex w-full justify-end" : "flex w-full justify-start"}>
                <div className={m.role === "user" ? "max-w-[85%] text-right" : "max-w-[85%] text-left"}>
                  {m.role === "assistant" ? (
                    <div className="mb-1 text-[10px] font-semibold tracking-wide text-gray-500">
                      {mode === "human" ? "Support" : title}
                    </div>
                  ) : null}
                  <div
                    className={
                      m.role === "user"
                        ? "inline-block rounded-2xl bg-black px-3 py-2 text-sm text-white shadow-sm"
                        : "inline-block rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm"
                    }
                    style={m.role === "user" ? { background: "linear-gradient(135deg, #111827, #000)" } : undefined}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 px-3 py-3">
            {error ? <div className="mb-2 text-xs text-red-600">{error}</div> : null}
            <div className="mb-2 flex items-center justify-between gap-2">
              {mode === "assistant" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHumanAgent("Aricka");
                      setMode("human");
                    }}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Chat with Aricka
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHumanAgent("Rahul");
                      setMode("human");
                    }}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Chat with Rahul
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("assistant")}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Back to assistant
                  </button>
                  <span className="text-[11px] text-gray-500">Support: {humanAgent}</span>
                </div>
              )}
              {mode === "human" ? (
                <span className="text-[11px] text-gray-500">Replies will appear here.</span>
              ) : null}
            </div>
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
          className="rounded-full px-4 py-1 text-sm font-semibold text-white shadow-xl ring-1 ring-white/20 hover:shadow-2xl hover:ring-white/30 transition-all duration-200"
          style={{ background: "linear-gradient(90deg, var(--cp-chat-primary), var(--cp-chat-accent))" }}
        >
          <span className="flex items-center gap-3">
            <span className="cp-chat-stack h-12 w-12">
              <img
                src="/bot/staff-1.svg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                alt=""
                className="cp-chat-staff-1 h-12 w-12 rounded-full border border-white/60 object-cover bg-white/20 shadow-sm"
              />
              <img
                src="/bot/staff-2.svg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                alt=""
                className="cp-chat-staff-2 h-12 w-12 rounded-full border border-white/60 object-cover bg-white/20 shadow-sm"
              />
              <img
                src="/bot/128660445-eac307db-718e-453b-81c7-30247c5dcac6.gif"
                alt="Bot"
                className="cp-chat-bot-avatar h-12 w-12 rounded-full border border-white/90 object-cover bg-white/20 shadow-sm"
              />
              <span
                className="cp-chat-online-dot h-4 w-4 rounded-full border-2 border-white bg-emerald-400"
                aria-hidden="true"
                title="Online"
              />
            </span>
            <span className="leading-none">{title}</span>
          </span>
        </button>
      )}
    </div>,
    document.body
  );
}
