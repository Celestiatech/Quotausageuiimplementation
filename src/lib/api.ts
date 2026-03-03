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
  if (error instanceof Error) {
    return fail(error.message || fallbackMessage, 500, "INTERNAL_ERROR");
  }
  return fail(fallbackMessage, 500, "INTERNAL_ERROR");
}
