"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from "lucide-react";
import { BookingPolicy } from "@/components/booking/booking-policy";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import {
  BookingStepper,
  stepIndex,
  type BookingStepId,
} from "@/components/booking/booking-stepper";
import {
  BookingSummary,
  DepositBreakdown,
  MobileBookingBar,
} from "@/components/booking/booking-summary";
import { CardPayment, type SandboxCard } from "@/components/booking/card-payment";
import { ConfirmationCard } from "@/components/booking/confirmation-card";
import {
  CustomerDetailsForm,
  type CustomerDetailsValues,
} from "@/components/booking/customer-details-form";
import { MobileMoneyPayment } from "@/components/booking/mobile-money-payment";
import { PaymentMethodSelector } from "@/components/booking/payment-method-selector";
import { PaymentStatusPanel } from "@/components/booking/payment-status-panel";
import { ReservationTimer } from "@/components/booking/reservation-timer";
import { ServiceSelector } from "@/components/booking/service-selector";
import { TimeSlotGrid } from "@/components/booking/time-slot-grid";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDaySlots, useMonthAvailability } from "@/hooks/use-availability";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { formatKwacha } from "@/lib/money";
import { formatDateLong, monthKeyForDateKey } from "@/lib/time";
import type { MobileMoneyProviderId } from "@/lib/phone";
import type { BookingDto, PaymentDto, PaymentMethod, ServiceDto } from "@/types";

export type BookingFlowConfig = {
  businessName: string;
  timezone: string;
  depositNgwee: number;
  policyParagraphs: string[];
  currentMonth: string;
  maxMonth: string;
  bookingWindowDays: number;
  reservationMinutes: number;
  sandboxCards: SandboxCard[];
  sandboxMode: boolean;
};

type CreateBookingResponse = { booking: BookingDto; reservationMinutes: number };
type PaymentResponse = {
  payment: PaymentDto;
  booking: BookingDto;
  instruction: string | null;
  redirectUrl: string | null;
  sandbox: boolean;
  provider: string;
};
type PaymentStatusResponse = {
  payment: PaymentDto;
  booking: BookingDto;
  message: string;
  sandboxControls: boolean;
};

const POLL_INTERVAL_MS = 2_500;

/**
 * Orchestrates the five-step booking journey. Selections live here so moving
 * backwards never loses valid choices, and every step re-validates against the
 * server before money is involved.
 */
export function BookingFlow({
  services,
  config,
  initialServiceId,
}: {
  services: ServiceDto[];
  config: BookingFlowConfig;
  initialServiceId?: string | null;
}) {
  const [step, setStep] = useState<BookingStepId>(initialServiceId ? "datetime" : "service");
  const [service, setService] = useState<ServiceDto | null>(
    services.find((entry) => entry.id === initialServiceId) ?? null,
  );
  const [month, setMonth] = useState(config.currentMonth);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [details, setDetails] = useState<CustomerDetailsValues | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyError, setPolicyError] = useState<string | undefined>();

  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [instruction, setInstruction] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string>("");
  const [sandboxControls, setSandboxControls] = useState(false);

  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const headingRef = useRef<HTMLDivElement>(null);

  const monthData = useMonthAvailability(service?.id ?? null, month);
  const dayData = useDaySlots(service?.id ?? null, step === "datetime" ? date : null);

  const depositNgwee = service
    ? Math.min(config.depositNgwee, service.priceNgwee)
    : config.depositNgwee;

  const selection = useMemo(
    () => ({ service, date, time, depositNgwee }),
    [service, date, time, depositNgwee],
  );

  // Keep focus and scroll position sensible when the step changes.
  useEffect(() => {
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const goTo = useCallback((next: BookingStepId) => {
    setError(null);
    setFieldErrors({});
    setStep(next);
  }, []);

  function handleServiceSelect(next: ServiceDto) {
    setService(next);
    // A different duration changes which slots fit, so re-pick the time.
    if (next.id !== service?.id) setTime(null);
    goTo("datetime");
  }

  function handleDateSelect(nextDate: string) {
    setDate(nextDate);
    setTime(null);
    if (monthKeyForDateKey(nextDate) !== month) setMonth(monthKeyForDateKey(nextDate));
  }

  async function handleDetailsSubmit(values: CustomerDetailsValues) {
    setDetails(values);
    if (!policyAccepted) {
      setPolicyError("Please accept the booking policy to continue.");
      return;
    }
    await createReservation(values);
  }

  /** Holds the slot, then moves to payment. */
  async function createReservation(values: CustomerDetailsValues) {
    if (!service || !date || !time) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const data = await apiRequest<CreateBookingResponse>("/api/bookings", {
        method: "POST",
        json: {
          serviceId: service.id,
          date,
          startTime: time,
          customer: values,
          policyAccepted: true,
        },
      });
      setBooking(data.booking);
      setPayment(null);
      setMethod(null);
      setInstruction(null);
      setPaymentMessage("");
      goTo("payment");
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fields ?? {});
        if (caught.code === "SLOT_UNAVAILABLE" || caught.code === "DAY_UNAVAILABLE") {
          setTime(null);
          void monthData.reload();
          goTo("datetime");
          setError(caught.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function startPayment(
    selectedMethod: PaymentMethod,
    payload: { mobileMoney?: { provider: MobileMoneyProviderId; phone: string }; card?: { token: string } },
  ) {
    if (!booking) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const data = await apiRequest<PaymentResponse>("/api/payments", {
        method: "POST",
        json: {
          bookingReference: booking.reference,
          method: selectedMethod,
          ...payload,
        },
      });
      setPayment(data.payment);
      setBooking(data.booking);
      setInstruction(data.instruction);
      setSandboxControls(data.sandbox && config.sandboxMode);
      setPaymentMessage(
        data.payment.status === "PROCESSING"
          ? "Your payment is being processed."
          : "Waiting for the payment to start…",
      );
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fields ?? {});
        if (
          caught.code === "RESERVATION_EXPIRED" ||
          caught.code === "SLOT_UNAVAILABLE"
        ) {
          resetToDateTime(caught.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Poll while a payment is in flight; the provider decides the outcome. */
  useEffect(() => {
    if (!payment || !["PENDING", "PROCESSING"].includes(payment.status)) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const data = await apiRequest<PaymentStatusResponse>(`/api/payments/${payment.id}`);
        if (cancelled) return;
        setPayment(data.payment);
        setBooking(data.booking);
        setPaymentMessage(data.message);
        setSandboxControls(data.sandboxControls);
        if (data.booking.status === "CONFIRMED" && data.payment.status === "SUCCESSFUL") {
          setStep("confirmed");
        }
      } catch {
        // Transient failures are ignored; the next tick tries again.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [payment]);

  async function settleSandbox(outcome: "approve" | "decline") {
    if (!payment) return;
    setSettling(true);
    try {
      const data = await apiRequest<PaymentStatusResponse>("/api/payments/sandbox", {
        method: "POST",
        json: { paymentId: payment.id, outcome },
      });
      setPayment(data.payment);
      setBooking(data.booking);
      setPaymentMessage(data.message);
      if (data.booking.status === "CONFIRMED" && data.payment.status === "SUCCESSFUL") {
        setStep("confirmed");
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSettling(false);
    }
  }

  function resetToDateTime(message: string) {
    setBooking(null);
    setPayment(null);
    setMethod(null);
    setTime(null);
    void monthData.reload();
    setStep("datetime");
    setError(message);
  }

  function restart() {
    setService(null);
    setDate(null);
    setTime(null);
    setDetails(null);
    setPolicyAccepted(false);
    setBooking(null);
    setPayment(null);
    setMethod(null);
    setInstruction(null);
    setPaymentMessage("");
    setError(null);
    setStep("service");
  }

  const canContinueFromDateTime = Boolean(service && date && time);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:pb-16">
      <div ref={headingRef} className="scroll-mt-20 space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blush-700">
            Step {stepIndex(step) + 1} of 5
          </p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            {step === "service" && "Choose your lash service"}
            {step === "datetime" && "Pick your date & time"}
            {step === "details" && "Your details"}
            {step === "payment" && `Secure your slot with ${formatKwacha(depositNgwee)}`}
            {step === "confirmed" && "You are all set"}
          </h1>
        </div>

        <BookingStepper
          current={step}
          onStepSelect={(next) => {
            if (step === "payment" && next !== "payment") return;
            goTo(next);
          }}
        />
      </div>

      {error ? (
        <Alert tone="danger" title="Please check this" className="mt-5">
          <p>{error}</p>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          {step === "service" ? (
            <ServiceSelector
              services={services}
              selectedServiceId={service?.id ?? null}
              onSelect={handleServiceSelect}
            />
          ) : null}

          {step === "datetime" && service ? (
            <>
              <Card>
                <CardContent className="space-y-4 p-5 pt-5">
                  <h2 className="flex items-center gap-2 font-display text-xl text-ink">
                    <CalendarDays className="size-5 text-blush-500" aria-hidden />
                    Select a date
                  </h2>
                  <BookingCalendar
                    month={month}
                    days={monthData.days}
                    selectedDate={date}
                    loading={monthData.loading}
                    error={monthData.error}
                    minMonth={config.currentMonth}
                    maxMonth={config.maxMonth}
                    onMonthChange={setMonth}
                    onSelect={handleDateSelect}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-5 pt-5">
                  <h2 className="flex items-center gap-2 font-display text-xl text-ink">
                    <Clock className="size-5 text-blush-500" aria-hidden />
                    Select a time
                  </h2>
                  {date ? (
                    <>
                      <p className="text-sm text-ink-soft">
                        Times for {formatDateLong(date)} · {service.durationLabel} appointment
                      </p>
                      <TimeSlotGrid
                        slots={dayData.data?.slots ?? []}
                        selectedTime={time}
                        loading={dayData.loading}
                        error={dayData.error}
                        suggestions={dayData.data?.suggestions ?? []}
                        onSelect={setTime}
                        onPickSuggestion={handleDateSelect}
                      />
                    </>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-blush-200 bg-white/60 p-5 text-sm text-ink-soft">
                      Choose a date above to see the times that are open.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="hidden gap-3 lg:flex">
                <Button variant="secondary" onClick={() => goTo("service")}>
                  <ArrowLeft aria-hidden /> Change service
                </Button>
                <Button
                  disabled={!canContinueFromDateTime}
                  onClick={() => goTo("details")}
                >
                  Continue <ArrowRight aria-hidden />
                </Button>
              </div>
            </>
          ) : null}

          {step === "details" && service && date && time ? (
            <>
              <Card>
                <CardContent className="p-5 pt-5">
                  <CustomerDetailsForm
                    formId="customer-details-form"
                    defaultValues={details ?? undefined}
                    serverFieldErrors={fieldErrors}
                    onSubmit={handleDetailsSubmit}
                  />
                </CardContent>
              </Card>

              <BookingPolicy
                paragraphs={config.policyParagraphs}
                depositNgwee={depositNgwee}
                accepted={policyAccepted}
                error={policyError}
                onAcceptedChange={(value) => {
                  setPolicyAccepted(value);
                  if (value) setPolicyError(undefined);
                }}
              />

              <Card>
                <CardContent className="space-y-3 p-5 pt-5">
                  <h2 className="font-display text-lg text-ink">What you pay today</h2>
                  <DepositBreakdown
                    totalNgwee={service.priceNgwee}
                    depositNgwee={depositNgwee}
                  />
                </CardContent>
              </Card>

              <div className="hidden gap-3 lg:flex">
                <Button variant="secondary" onClick={() => goTo("datetime")}>
                  <ArrowLeft aria-hidden /> Back
                </Button>
                <Button
                  type="submit"
                  form="customer-details-form"
                  loading={busy}
                  loadingText="Holding your slot…"
                >
                  Continue to payment <ArrowRight aria-hidden />
                </Button>
              </div>
            </>
          ) : null}

          {step === "payment" && booking ? (
            <div className="space-y-5">
              {booking.reservationExpiresAt && booking.status === "PENDING_PAYMENT" ? (
                <ReservationTimer
                  expiresAt={booking.reservationExpiresAt}
                  onExpire={() =>
                    resetToDateTime(
                      "Your reservation expired and the slot has been released. Please pick a time again.",
                    )
                  }
                />
              ) : null}

              <Card>
                <CardContent className="space-y-4 p-5 pt-5">
                  <div className="rounded-2xl border border-blush-200 bg-blush-50/70 p-4">
                    <p className="text-sm font-medium text-blush-800">
                      You are paying {formatKwacha(booking.amounts.depositNgwee)} now to
                      secure this appointment.
                    </p>
                    <div className="mt-3">
                      <DepositBreakdown
                        totalNgwee={booking.amounts.totalNgwee}
                        depositNgwee={booking.amounts.depositNgwee}
                        compact
                      />
                    </div>
                  </div>

                  {!payment ? (
                    <>
                      <PaymentMethodSelector
                        value={method}
                        disabled={busy}
                        onChange={setMethod}
                      />

                      {method === "MOBILE_MONEY" ? (
                        <MobileMoneyPayment
                          depositNgwee={booking.amounts.depositNgwee}
                          defaultPhone={booking.customerPhone}
                          submitting={busy}
                          fieldErrors={fieldErrors}
                          onPay={(momo) => startPayment("MOBILE_MONEY", { mobileMoney: momo })}
                        />
                      ) : null}

                      {method === "BANK_CARD" ? (
                        <CardPayment
                          depositNgwee={booking.amounts.depositNgwee}
                          cards={config.sandboxCards}
                          sandbox={config.sandboxMode}
                          submitting={busy}
                          fieldErrors={fieldErrors}
                          onPay={(card) => startPayment("BANK_CARD", { card })}
                        />
                      ) : null}
                    </>
                  ) : (
                    <PaymentStatusPanel
                      payment={payment}
                      message={paymentMessage}
                      instruction={instruction}
                      sandboxControls={sandboxControls}
                      settling={settling}
                      onSandboxSettle={settleSandbox}
                      onRetry={() => {
                        setPayment(null);
                        setMethod(null);
                        setInstruction(null);
                        setPaymentMessage("");
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              <p className="text-center text-xs text-ink-muted">
                Booking reference {booking.reference} · Your appointment is confirmed only
                after a successful payment.
              </p>
            </div>
          ) : null}

          {step === "confirmed" && booking ? (
            <ConfirmationCard
              booking={booking}
              businessName={config.businessName}
              timezone={config.timezone}
              onBookAnother={restart}
            />
          ) : null}
        </div>

        {/* Desktop summary rail */}
        {step !== "confirmed" ? (
          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <BookingSummary selection={selection} />
          </aside>
        ) : null}
      </div>

      {/* Mobile sticky summary + primary action */}
      {step === "service" ? (
        <MobileBookingBar
          selection={selection}
          actionLabel="Continue"
          actionDisabled={!service}
          helper="Choose a service to continue"
          onAction={() => goTo("datetime")}
        />
      ) : null}

      {step === "datetime" ? (
        <MobileBookingBar
          selection={selection}
          actionLabel="Continue"
          actionDisabled={!canContinueFromDateTime}
          helper={date ? "Pick a time" : "Pick a date and time"}
          onAction={() => goTo("details")}
        />
      ) : null}

      {step === "details" ? (
        <MobileBookingSubmitBar
          selection={selection}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

/** The details step submits the form, so its bar needs a real submit button. */
function MobileBookingSubmitBar({
  selection,
  busy,
}: {
  selection: { service: ServiceDto | null; date: string | null; time: string | null; depositNgwee: number };
  busy: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-float backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {selection.service?.name ?? ""}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {selection.date ? `${formatDateLong(selection.date)} · ${selection.time}` : ""}
          </p>
          <p className="text-xs font-medium text-blush-700">
            Deposit: {formatKwacha(selection.depositNgwee)}
          </p>
        </div>
        <Button type="submit" form="customer-details-form" loading={busy} loadingText="Holding…">
          Continue
        </Button>
      </div>
    </div>
  );
}
