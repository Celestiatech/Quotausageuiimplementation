import path from "path";
import { spawn } from "child_process";

export type AutoApplyRunInput = {
  criteria: Record<string, unknown>;
  profileSnapshot?: Record<string, unknown>;
  credentials: {
    username: string;
    password: string;
  };
};

export type AutoApplyRunResult = {
  status: "success" | "failed";
  applications: Array<{
    externalJobId?: string;
    company?: string;
    title?: string;
    status: "submitted" | "skipped" | "failed";
    metadata?: Record<string, unknown>;
  }>;
  errorMessage?: string;
};

type BridgeOutput = {
  success: boolean;
  error?: string;
  appliedDelta?: number;
  newApplications?: Array<{
    jobId?: string;
    title?: string;
    company?: string;
    dateApplied?: string;
    jobLink?: string;
    applicationLink?: string;
  }>;
};

function resolveAutomationRoot() {
  return process.env.AUTO_APPLIER_ROOT || path.resolve(process.cwd(), "..", "Auto_job_applier_linkedIn");
}

function resolveBridgeScript() {
  return path.resolve(process.cwd(), "scripts", "linkedin_bridge_runner.py");
}

function normalizeSearchTerms(criteria: Record<string, unknown>) {
  const direct = criteria.searchTerms;
  if (Array.isArray(direct)) {
    return direct.map((item) => String(item).trim()).filter(Boolean);
  }
  const keyword = (criteria.keyword || criteria.title || "").toString().trim();
  if (keyword) return [keyword];
  return ["Software Engineer"];
}

function normalizeSearchLocation(criteria: Record<string, unknown>) {
  return (criteria.searchLocation || criteria.location || "United States").toString().trim();
}

function normalizeMarketingConsent(criteria: Record<string, unknown>) {
  const value = String(criteria.marketingConsent || "").toLowerCase().trim();
  return value === "yes" ? "Yes" : "No";
}

function normalizeMaxApplications(criteria: Record<string, unknown>) {
  const raw = Number(criteria.maxApplications || criteria.limit || 3);
  if (!Number.isFinite(raw) || raw <= 0) return 3;
  return Math.min(Math.floor(raw), 25);
}

function toBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export async function runAutoApply(input: AutoApplyRunInput): Promise<AutoApplyRunResult> {
  const python = process.env.PYTHON_BIN || "python";
  const automationRoot = resolveAutomationRoot();
  const bridgeScript = resolveBridgeScript();
  const timeoutSec = Number(process.env.AUTO_APPLIER_TIMEOUT_SEC || 900);

  const payload = {
    repoRoot: automationRoot,
    username: input.credentials.username,
    password: input.credentials.password,
    searchTerms: normalizeSearchTerms(input.criteria),
    searchLocation: normalizeSearchLocation(input.criteria),
    currentCity: (input.criteria.currentCity || "").toString().trim(),
    marketingConsent: normalizeMarketingConsent(input.criteria),
    maxApplications: normalizeMaxApplications(input.criteria),
    runInBackground: toBool(process.env.AUTO_APPLIER_HEADLESS, false),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

  return new Promise<AutoApplyRunResult>((resolve) => {
    const child = spawn(python, [bridgeScript, payloadBase64], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, Math.max(timeoutSec, 60) * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        resolve({
          status: "failed",
          applications: [],
          errorMessage: `Auto-applier timed out after ${timeoutSec}s`,
        });
        return;
      }

      const lines = (stdout + "\n" + stderr)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      let parsed: BridgeOutput | null = null;
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (!line.startsWith("{") || !line.endsWith("}")) continue;
        try {
          const maybe = JSON.parse(line) as BridgeOutput;
          if (typeof maybe.success === "boolean") {
            parsed = maybe;
            break;
          }
        } catch {
          continue;
        }
      }

      if (code !== 0 || !parsed || !parsed.success) {
        const bridgeError = parsed?.error || "";
        const stderrTail = stderr.split(/\r?\n/).slice(-8).join(" ").trim();
        resolve({
          status: "failed",
          applications: [],
          errorMessage:
            bridgeError || stderrTail || `Auto-applier process failed with exit code ${code ?? -1}`,
        });
        return;
      }

      const apps =
        parsed.newApplications?.map((job) => ({
          externalJobId: job.jobId,
          company: job.company,
          title: job.title,
          status: "submitted" as const,
          metadata: {
            dateApplied: job.dateApplied,
            jobLink: job.jobLink,
            applicationLink: job.applicationLink,
            source: "linkedin-automation",
          },
        })) || [];

      resolve({
        status: "success",
        applications: apps,
      });
    });
  });
}
