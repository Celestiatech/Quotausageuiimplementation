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

function normalizeCount(value: unknown) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

function isSameLocalDay(value: unknown, now: Date) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function buildFallbackSummary(history: Record<string, unknown>) {
  const now = new Date();
  const appliedItems = Array.isArray(history?.applied) ? history.applied : [];
  const skippedItems = Array.isArray(history?.skipped) ? history.skipped : [];
  const failedItems = Array.isArray(history?.failed) ? history.failed : [];
  const externalItems = Array.isArray(history?.external) ? history.external : [];

  return {
    totals: {
      applied: appliedItems.length,
      skipped: skippedItems.length,
      failed: failedItems.length,
      external: externalItems.length,
    },
    today: {
      applied: appliedItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
      skipped: skippedItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
      failed: failedItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
      external: externalItems.filter((item: any) => isSameLocalDay(item?.ts, now)).length,
    },
  };
}

function normalizeImportEntry(entry: any, outcomeType: string) {
  return {
    ts: String(entry?.ts || ""),
    entryId: String(entry?.entryId || "").trim(),
    runId: String(entry?.runId || "").trim(),
    outcomeType: String(outcomeType || entry?.outcomeType || "").trim().toUpperCase(),
    data: entry?.data && typeof entry.data === "object" ? entry.data : {},
  };
}

function importKeyForEntry(entry: ReturnType<typeof normalizeImportEntry>) {
  if (entry.entryId) return entry.entryId;
  const data = entry.data && typeof entry.data === "object" ? entry.data : {};
  const jobId = String(data?.jobId || data?.externalJobId || "");
  const jobUrl = String(data?.jobUrl || "");
  const reasonCode = String(data?.reasonCode || "").toUpperCase();
  return `${entry.outcomeType}:${jobId || jobUrl}:${reasonCode}:${entry.ts}`;
}

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
    const timeoutMs = 6000;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setStats((prev) => ({ ...prev, loaded: true }));
    }, timeoutMs);
    const requestPrefix = `cp_pipe_${Date.now()}_`;

    const requestSnapshot = () => {
      if (!active) return;
      try {
        window.postMessage(
          {
            type: "CP_WEB_PING",
            requestId: `${requestPrefix}${Math.random().toString(36).slice(2, 8)}`,
          },
          window.location.origin,
        );
      } catch {
        // ignore
      }
    };

    const pingInterval = window.setInterval(() => {
      requestSnapshot();
    }, 10000);

    function onMessage(event: MessageEvent) {
      if (!active || event.source !== window) return;
      const data = event.data as any;
      if (!data || data.type !== "CP_WEB_PONG") return;
      if (!String(data.requestId || "").startsWith(requestPrefix)) return;

      const history = data.history || {};
      const historySummary =
        data.historySummary && typeof data.historySummary === "object"
          ? data.historySummary
          : buildFallbackSummary(history);
      const totals =
        historySummary?.totals && typeof historySummary.totals === "object"
          ? historySummary.totals
          : buildFallbackSummary(history).totals;
      const today =
        historySummary?.today && typeof historySummary.today === "object"
          ? historySummary.today
          : buildFallbackSummary(history).today;

      // Best-effort: import extension outcomes into the web DB so dashboard pages can show recent activity.
      // Use stable entry ids first so refreshes do not rebase the import window.
      try {
        const importedKey = "cpExtImportedOutcomeIdsV2";
        const raw = localStorage.getItem(importedKey) || "[]";
        const seen = new Set<string>(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []);
        const candidates = [
          ...(Array.isArray(history.applied) ? history.applied : []).map((item: any) => normalizeImportEntry(item, "APPLIED")),
          ...(Array.isArray(history.skipped) ? history.skipped : []).map((item: any) => normalizeImportEntry(item, "SKIPPED")),
          ...(Array.isArray(history.failed) ? history.failed : []).map((item: any) => normalizeImportEntry(item, "FAILED")),
          ...(Array.isArray(history.external) ? history.external : []).map((item: any) => normalizeImportEntry(item, "EXTERNAL")),
        ]
          .filter((entry) => entry.ts && entry.outcomeType)
          .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
          .slice(-160);
        const delta = candidates.filter((entry) => !seen.has(importKeyForEntry(entry))).slice(0, 80);
        if (delta.length) {
          void fetch("/api/extension/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries: delta, limit: 80 }),
            credentials: "include",
          })
            .then(() => {
              for (const entry of delta) seen.add(importKeyForEntry(entry));
              const next = Array.from(seen).slice(-5000);
              localStorage.setItem(importedKey, JSON.stringify(next));
              try {
                window.dispatchEvent(new Event("cp:extensionImported"));
              } catch {
                // ignore
              }
            })
            .catch(() => {
              // ignore import failures
            });
        }
      } catch {
        // ignore import failures
      }

      setStats({
        applied: normalizeCount(totals.applied),
        skipped: normalizeCount(totals.skipped) + normalizeCount(totals.external),
        failed: normalizeCount(totals.failed),
        appliedToday: Math.max(normalizeCount(today.applied), normalizeCount(data?.dailyCap?.used)),
        skippedToday: normalizeCount(today.skipped) + normalizeCount(today.external),
        failedToday: normalizeCount(today.failed),
        loaded: true,
      });
      window.clearTimeout(timer);
    }

    const onImported = () => requestSnapshot();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestSnapshot();
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("cp:extensionImported", onImported as EventListener);
    document.addEventListener("visibilitychange", onVisibilityChange);
    requestSnapshot();

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(pingInterval);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("cp:extensionImported", onImported as EventListener);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return stats;
}
