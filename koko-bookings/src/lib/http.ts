import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, GENERIC_ERROR_MESSAGE, ValidationError } from "@/lib/errors";
import type { ApiFailure, ApiResult } from "@/types";

/** Uniform JSON envelope so every client handles success and failure the same way. */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiResult<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiFailure(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>,
): NextResponse<ApiFailure> {
  return NextResponse.json({ ok: false, error: { code, message, fields } }, { status });
}

function zodToFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fields[key] ??= issue.message;
  }
  return fields;
}

/**
 * Wraps a route handler so unexpected failures are logged server-side and the
 * customer only ever sees a safe message.
 */
export function route<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        const validation = new ValidationError(
          "Please check the highlighted fields.",
          zodToFields(error),
        );
        return apiFailure(
          validation.code,
          validation.message,
          validation.status,
          validation.fields,
        );
      }
      if (error instanceof AppError) {
        return apiFailure(error.code, error.message, error.status, error.fields);
      }
      console.error("[api] unhandled error", error);
      return apiFailure("INTERNAL_ERROR", GENERIC_ERROR_MESSAGE, 500);
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ValidationError("We could not read that request.");
  }
}
