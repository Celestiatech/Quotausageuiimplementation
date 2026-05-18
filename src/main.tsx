
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

function initMicrosoftClarity(projectId: string) {
  const id = String(projectId || "").trim();
  if (!id) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (typeof (window as any).clarity === "function") return;

  (function (c: any, l: Document, a: string, r: string, i: string, t?: HTMLScriptElement, y?: Element) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y?.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
}

initMicrosoftClarity(import.meta.env.VITE_CLARITY_TAG_ID || "");

createRoot(document.getElementById("root")!).render(<App />);
  
