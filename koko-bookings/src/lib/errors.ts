/**
 * Domain errors carry a machine code, an HTTP status and a message that is
 * safe to show a customer. Anything else becomes a generic message so stack
 * traces and database details never reach the browser.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: string,
    message: string,
    status = 400,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the highlighted fields.", fields?: Record<string, string>) {
    super("VALIDATION_ERROR", message, 422, fields);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "We could not find what you were looking for.") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class SlotUnavailableError extends AppError {
  constructor(
    message = "This appointment was just booked by another customer. Please choose another time.",
  ) {
    super("SLOT_UNAVAILABLE", message, 409);
    this.name = "SlotUnavailableError";
  }
}

export class DayUnavailableError extends AppError {
  constructor(message = "No available appointments on this date.") {
    super("DAY_UNAVAILABLE", message, 409);
    this.name = "DayUnavailableError";
  }
}

export class ReservationExpiredError extends AppError {
  constructor(
    message = "Your reservation expired and the slot has been released. Please pick a time again.",
  ) {
    super("RESERVATION_EXPIRED", message, 410);
    this.name = "ReservationExpiredError";
  }
}

export class PaymentError extends AppError {
  constructor(message = "Payment failed. Your slot has been released.", code = "PAYMENT_FAILED") {
    super(code, message, 402);
    this.name = "PaymentError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this area.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Please wait a moment and try again.") {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitError";
  }
}

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
