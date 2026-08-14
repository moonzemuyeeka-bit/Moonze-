import { requireAdminApi } from "@/lib/auth/guard";
import {
  getBookingByReference,
  setBookingStatus,
  toBookingDto,
} from "@/lib/booking/booking-service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { apiSuccess, readJson, route } from "@/lib/http";
import { refundPayment } from "@/lib/payments/payment-service";
import { bookingStatusSchema } from "@/schemas/admin";

/** Changes a booking's status (confirm, complete, cancel, no-show). */
export const PATCH = route(async (request: Request) => {
  await requireAdminApi();
  const { reference, status, reason } = bookingStatusSchema.parse(await readJson(request));
  const booking = await setBookingStatus(reference, status, { reason });
  return apiSuccess({ booking: toBookingDto(booking) });
});

/** Refunds the deposit through the payment provider. */
export const POST = route(async (request: Request) => {
  await requireAdminApi();
  const { reference } = await readJson<{ reference?: string }>(request);
  if (!reference) throw new ValidationError("Provide the booking reference.");

  const booking = await getBookingByReference(reference);
  if (!booking) throw new NotFoundError("We could not find that booking.");

  const paid = booking.payments.find((payment) => payment.status === "SUCCESSFUL");
  if (!paid) throw new ValidationError("This booking has no deposit to refund.");

  const refunded = await refundPayment(paid.id);
  return apiSuccess({ payment: { id: refunded.id, status: refunded.status } });
});
