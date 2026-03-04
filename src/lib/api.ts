import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data?: T;
};

export type ApiError = {
  success: false;
  message: string;
  errorCode?: string;
};

export function ok<T>(message: string, data?: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, message, data }, { status });
}

export function fail(message: string, status = 400, errorCode?: string) {
  return NextResponse.json<ApiError>({ success: false, message, errorCode }, { status });
}

export function parseZodError(error: ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid request payload";
  return `${issue.path.join(".") || "payload"}: ${issue.message}`;
}

export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return fail(parseZodError(error), 400, "VALIDATION_ERROR");
  }
  const isProd = process.env.NODE_ENV === "production";
  if (error instanceof Error) {
    console.error("[api] internal error:", error);
    return fail(isProd ? fallbackMessage : error.message || fallbackMessage, 500, "INTERNAL_ERROR");
  }
  console.error("[api] unknown internal error:", error);
  return fail(fallbackMessage, 500, "INTERNAL_ERROR");
}

type PaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

export function parsePagination(req: Request, options?: PaginationOptions) {
  const defaultLimit = Math.max(1, Math.floor(options?.defaultLimit ?? 50));
  const maxLimit = Math.max(defaultLimit, Math.floor(options?.maxLimit ?? 200));
  const url = new URL(req.url);

  const rawPage = Number(url.searchParams.get("page") || "1");
  const rawLimit = Number(url.searchParams.get("limit") || String(defaultLimit));

  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(maxLimit, Math.floor(rawLimit)))
    : defaultLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
