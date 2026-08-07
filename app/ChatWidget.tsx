"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const WHATSAPP_PHONE = "919805559015";

function openWhatsApp(message: string) {
  const text = message.trim() || "Hi, I need support.";
  const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function ChatWidget() {
  const enabled = true; // Tawk.to always enabled
  const title = "Support";
  const position = "bottom-right" as "bottom-right" | "bottom-left";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Load Tawk.to script
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://embed.tawk.to/6a738294871d0d1d4a547563/1jv9jc91d/default"; // Replace YOUR_WIDGET_ID
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.body.appendChild(script);

    // Also add WhatsApp fallback buttons
    const addWhatsAppButtons = () => {
      const widget = document.querySelector("[data-cp-chat-widget]");
      if (widget && !widget.querySelector(".cp-whatsapp-fallback")) {
        const fallback = document.createElement("div");
        fallback.className = "cp-whatsapp-fallback";
        fallback.style.cssText = "position:fixed;bottom:90px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
        fallback.innerHTML = `
          <button onclick="window.open('https://wa.me/${WHATSAPP_PHONE}?text=Hi%20I%20need%20support','_blank')" 
            style="background:#25D366;color:white;border:none;padding:10px 16px;border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
            Chat with Aricka on WhatsApp
          </button>
          <button onclick="window.open('https://wa.me/${WHATSAPP_PHONE}?text=Hi%20I%20need%20support','_blank')" 
            style="background:#25D366;color:white;border:none;padding:10px 16px;border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
            Chat with Rahul on WhatsApp
          </button>
        `;
        widget.appendChild(fallback);
      }
    };

    // Wait for Tawk.to to load then add buttons
    const checkLoaded = setInterval(() => {
      if (window.Tawk_API) {
        clearInterval(checkLoaded);
        addWhatsAppButtons();
      }
    }, 500);

    return () => {
      clearInterval(checkLoaded);
      const existingScript = document.querySelector('script[src*="tawk.to"]');
      if (existingScript) existingScript.remove();
    };
  }, [enabled]);

  if (!enabled) return null;

  return createPortal(
    <div
      className={position === "bottom-left" ? "cp-chat-widget cp-chat-widget--left" : "cp-chat-widget"}
      data-cp-chat-widget="1"
    >
      <div id="tawk-widget-container"></div>
    </div>,
    document.body
  );
}

// Type declarations for Tawk.to
declare global {
  interface Window {
    Tawk_API: any;
    Tawk_LoadStart: Date;
  }
}
