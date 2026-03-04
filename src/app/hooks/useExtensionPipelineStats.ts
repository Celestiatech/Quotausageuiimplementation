import { useEffect, useState } from "react";

export type ExtensionPipelineStats = {
  applied: number;
  skipped: number;
  failed: number;
  appliedToday: number;
  skippedToday: number;
  failedToday: number;
  loaded: boolean;
};

export function useExtensionPipelineStats() {
  const [stats, setStats] = useState<ExtensionPipelineStats>({
    applied: 0,
    skipped: 0,
    failed: 0,
    appliedToday: 0,
    skippedToday: 0,
    failedToday: 0,
    loaded: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    const requestId = `cp_pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timeoutMs = 6000;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setStats((prev) => ({ ...prev, loaded: true }));
      window.removeEventListener("message", onMessage);
    }, timeoutMs);
    const pingInterval = window.setInterval(() => {
      if (!active) return;
      try {
        window.postMessage({ type: "CP_WEB_PING", requestId }, window.location.origin);
      } catch {
        // ignore
      }
    }, 500);

    function onMessage(event: MessageEvent) {
      if (!active || event.source !== window) return;
      const data = event.data as any;
      if (!data || data.type !== "CP_WEB_PONG" || data.requestId !== requestId) return;
      const history = data.history || {};
      const appliedItems = Array.isArray(history.applied) ? history.applied : [];
      const skippedItems = Array.isArray(history.skipped) ? history.skipped : [];
      const failedItems = Array.isArray(history.failed) ? history.failed : [];
      const applied = Math.max(appliedItems.length, Number(data?.state?.applied || 0));
      const skipped = Math.max(skippedItems.length, Number(data?.state?.skipped || 0));
      const failed = Math.max(failedItems.length, Number(data?.state?.failed || 0));
      const now = new Date();
      const isSameLocalDay = (value: unknown) => {
        const date = new Date(String(value || ""));
        if (Number.isNaN(date.getTime())) return false;
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate()
        );
      };
      const appliedTodayFromHistory = appliedItems.filter((item: any) => isSameLocalDay(item?.ts)).length;
      const skippedToday = skippedItems.filter((item: any) => isSameLocalDay(item?.ts)).length;
      const failedToday = failedItems.filter((item: any) => isSameLocalDay(item?.ts)).length;
      const appliedTodayFromCap = Number(data?.dailyCap?.used ?? NaN);
      const appliedToday = Number.isFinite(appliedTodayFromCap)
        ? Math.max(0, Math.max(appliedTodayFromHistory, appliedTodayFromCap))
        : Math.max(0, appliedTodayFromHistory);

      // Best-effort: import extension outcomes into the web DB so dashboard pages can show recent activity.
      // This runs on the dashboard origin using cookies (no extension token needed).
      try {
        const importedKey = "cpExtImportedOutcomeKeys";
        const raw = localStorage.getItem(importedKey) || "[]";
        const seen = new Set<string>(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []);
        const toEntry = (x: any) => ({
          ts: String(x?.ts || ""),
          outcomeType: String(x?.outcomeType || ""),
          data: x?.data && typeof x.data === "object" ? x.data : {},
        });
        const candidates = [
          ...appliedItems.map(toEntry),
          ...skippedItems.map(toEntry),
          ...failedItems.map(toEntry),
        ]
          .filter((e) => e.ts && e.outcomeType)
          .slice(-120);
        const keyFor = (e: any) => {
          const jobId = String(e?.data?.jobId || "");
          const jobUrl = String(e?.data?.jobUrl || "");
          return `${String(e.outcomeType || "")}:${jobId || jobUrl}:${String(e.ts || "")}`;
        };
        const delta = candidates.filter((e) => !seen.has(keyFor(e))).slice(0, 60);
        if (delta.length) {
          void fetch("/api/extension/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries: delta }),
            credentials: "include",
          }).then(() => {
            try {
              window.dispatchEvent(new Event("cp:extensionImported"));
            } catch {
              // ignore
            }
            for (const e of delta) seen.add(keyFor(e));
            const next = Array.from(seen).slice(-3000);
            localStorage.setItem(importedKey, JSON.stringify(next));
          }).catch(() => {
            // ignore import failures
          });
        }
      } catch {
        // ignore import failures
      }

      setStats({
        applied: Math.max(0, applied),
        skipped: Math.max(0, skipped),
        failed: Math.max(0, failed),
        appliedToday: Math.max(0, appliedToday),
        skippedToday: Math.max(0, skippedToday),
        failedToday: Math.max(0, failedToday),
        loaded: true,
      });
      window.clearTimeout(timer);
      window.clearInterval(pingInterval);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: "CP_WEB_PING", requestId }, window.location.origin);

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(pingInterval);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return stats;
}
