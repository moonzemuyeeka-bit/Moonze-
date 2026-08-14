import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";
import type { ApiResult } from "@/types";

export class ApiClientError extends Error {
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.fields = fields;
  }
}

/** Browser-side fetch that unwraps the API envelope and throws typed errors. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "We could not reach the salon. Check your connection and try again.",
    );
  }

  let payload: ApiResult<T> | null = null;
  try {
    payload = (await response.json()) as ApiResult<T>;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new ApiClientError("INVALID_RESPONSE", GENERIC_ERROR_MESSAGE);
  }
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message || GENERIC_ERROR_MESSAGE,
      payload.error.fields,
    );
  }
  return payload.data;
}
