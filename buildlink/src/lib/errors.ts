/**
 * Error taxonomy and the server-action result contract.
 *
 * Raw database or provider errors must never reach a user. Anything thrown
 * inside a mutation is funnelled through `toActionError`, which returns a
 * human-readable message for known application errors and a generic apology
 * (plus a server-side log) for anything unexpected.
 */

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  /** Safe to display verbatim to an end user. */
  readonly userFacing: boolean;

  constructor(
    message: string,
    options: { code?: string; statusCode?: number; userFacing?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code ?? "APP_ERROR";
    this.statusCode = options.statusCode ?? 400;
    this.userFacing = options.userFacing ?? true;
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message = "Please check the highlighted fields.", fieldErrors: Record<string, string[]> = {}) {
    super(message, { code: "VALIDATION_ERROR", statusCode: 422 });
    this.fieldErrors = fieldErrors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, { code: "UNAUTHENTICATED", statusCode: 401 });
  }
}

export class AuthorisationError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(message, { code: "FORBIDDEN", statusCode: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "record") {
    super(`We could not find that ${resource}.`, { code: "NOT_FOUND", statusCode: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, { code: "CONFLICT", statusCode: 409 });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      `Too many attempts. Please try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`,
      { code: "RATE_LIMITED", statusCode: 429 },
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** A required integration (payments, storage, SMS) is not configured. */
export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, { code: "NOT_CONFIGURED", statusCode: 503 });
  }
}

/** An attempt to move a record into a state its state machine forbids. */
export class InvalidTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super(`A ${entity} cannot move from "${from}" to "${to}".`, {
      code: "INVALID_TRANSITION",
      statusCode: 409,
    });
  }
}

// ---------------------------------------------------------------------------
// Server-action results
// ---------------------------------------------------------------------------

export type ActionSuccess<T> = { ok: true; data: T };
export type ActionFailure = {
  ok: false;
  error: string;
  code: string;
  fieldErrors?: Record<string, string[]>;
};
export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function actionSuccess(): ActionResult<undefined>;
export function actionSuccess<T>(data: T): ActionResult<T>;
export function actionSuccess<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionFailure(
  error: string,
  code = "APP_ERROR",
  fieldErrors?: Record<string, string[]>,
): ActionFailure {
  return fieldErrors ? { ok: false, error, code, fieldErrors } : { ok: false, error, code };
}

const GENERIC_MESSAGE =
  "Something went wrong on our side. Please try again — if it keeps happening, contact BuildLink support.";

/**
 * Converts any thrown value into a safe `ActionFailure`.
 *
 * Next.js control-flow signals (`redirect()`, `notFound()`) throw specially
 * shaped errors that must be re-thrown, never swallowed.
 */
export function toActionError(error: unknown, context?: string): ActionFailure {
  if (isNextControlFlowError(error)) throw error;

  if (error instanceof ValidationError) {
    return actionFailure(error.message, error.code, error.fieldErrors);
  }

  if (error instanceof AppError && error.userFacing) {
    return actionFailure(error.message, error.code);
  }

  console.error(`[buildlink] unhandled error${context ? ` in ${context}` : ""}:`, error);
  return actionFailure(GENERIC_MESSAGE, "INTERNAL_ERROR");
}

/**
 * `redirect()` and `notFound()` work by throwing. Their errors carry a `digest`
 * string, and rethrowing them is the only correct handling.
 */
export function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest === "NEXT_NOT_FOUND" ||
      digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}

/** Recognises Prisma's unique-constraint violation without importing the client. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}
