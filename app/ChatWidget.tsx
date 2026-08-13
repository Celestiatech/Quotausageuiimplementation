"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";

const WHATSAPP_PHONE = "919805559015";

function openWhatsApp(message: string) {
  const text = message.trim() || "Hi, I need support.";
  const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function ChatWidget() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 2147483647,
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageCircle style={{ width: "24px", height: "24px", color: "white" }} />
        </button>
      )}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 2147483647,
            width: "320px",
            background: "white",
            borderRadius: "16px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: "white", fontWeight: 700, fontSize: "16px" }}>Support Chat</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
            >
              <X style={{ width: "20px", height: "20px", color: "white" }} />
            </button>
          </div>
          <div style={{ padding: "16px" }}>
            <p style={{ fontSize: "14px", color: "#374151", marginBottom: "12px" }}>
              Need help? Chat with us on WhatsApp!
            </p>
            <button
              onClick={() => openWhatsApp("Hi, I need support.")}
              style={{
                width: "100%",
                padding: "12px",
                background: "#25D366",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Chat with Aricka on WhatsApp
            </button>
            <button
              onClick={() => openWhatsApp("Hi, I need support.")}
              style={{
                width: "100%",
                padding: "12px",
                background: "#25D366",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "8px",
              }}
            >
              Chat with Rahul on WhatsApp
            </button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

