export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  error?: string;
}

const MAX_BUFFER_SIZE = 500;
const logBuffer: LogEntry[] = [];

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.context ? `[${entry.context}]` : "",
    entry.message,
  ].filter(Boolean);
  if (entry.error) parts.push(`error=${entry.error}`);
  return parts.join(" ");
}

function push(entry: LogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.splice(0, logBuffer.length - MAX_BUFFER_SIZE);
  }
  const formatted = formatEntry(entry);
  if (entry.level === "error") {
    console.error(formatted);
  } else if (entry.level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export function logInfo(message: string, context?: string, data?: unknown) {
  push({ timestamp: new Date().toISOString(), level: "info", message, context, data });
}

export function logWarn(message: string, context?: string, data?: unknown) {
  push({ timestamp: new Date().toISOString(), level: "warn", message, context, data });
}

export function logError(message: string, context?: string, error?: unknown, data?: unknown) {
  push({
    timestamp: new Date().toISOString(),
    level: "error",
    message,
    context,
    data,
    error: error instanceof Error ? error.message : String(error || ""),
  });
}

export function logDebug(message: string, context?: string, data?: unknown) {
  if (process.env.NODE_ENV === "production") return;
  push({ timestamp: new Date().toISOString(), level: "debug", message, context, data });
}

export function getRecentLogs(count = 50): LogEntry[] {
  return logBuffer.slice(-count);
}

export function clearLogs() {
  logBuffer.length = 0;
}
