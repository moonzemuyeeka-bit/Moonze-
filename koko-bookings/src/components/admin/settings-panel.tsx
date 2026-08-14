"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, Save, Store, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { toKwacha } from "@/lib/money";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type SettingsValues = {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  currency: string;
  depositNgwee: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  bookingWindowDays: number;
  minNoticeHours: number;
  reservationMinutes: number;
  maxDailyBookings: number;
  depositPolicy: string;
  cancellationPolicy: string;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  notifyEmail: boolean;
  reminderDayBefore: boolean;
  reminderHoursBefore: number;
};

export type WorkingHoursValue = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  closed: boolean;
};

/** Every business rule the owner can change without a developer. */
export function SettingsPanel({
  settings,
  workingHours,
}: {
  settings: SettingsValues;
  workingHours: WorkingHoursValue[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...settings,
    depositKwacha: String(toKwacha(settings.depositNgwee)),
  });
  const [hours, setHours] = useState(workingHours);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSavingSettings(true);
    setError(null);
    setNote(null);
    setFieldErrors({});
    try {
      await apiRequest("/api/admin/settings", {
        method: "PUT",
        json: {
          businessName: form.businessName,
          businessPhone: form.businessPhone,
          businessEmail: form.businessEmail,
          depositKwacha: Number(form.depositKwacha),
          slotIntervalMinutes: Number(form.slotIntervalMinutes),
          bufferMinutes: Number(form.bufferMinutes),
          bookingWindowDays: Number(form.bookingWindowDays),
          minNoticeHours: Number(form.minNoticeHours),
          reservationMinutes: Number(form.reservationMinutes),
          maxDailyBookings: Number(form.maxDailyBookings),
          depositPolicy: form.depositPolicy,
          cancellationPolicy: form.cancellationPolicy,
          notifyWhatsapp: form.notifyWhatsapp,
          notifySms: form.notifySms,
          notifyEmail: form.notifyEmail,
          reminderDayBefore: form.reminderDayBefore,
          reminderHoursBefore: Number(form.reminderHoursBefore),
        },
      });
      setNote("Business settings saved.");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fields ?? {});
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveHours(event: React.FormEvent) {
    event.preventDefault();
    setSavingHours(true);
    setError(null);
    setNote(null);
    try {
      await apiRequest("/api/admin/settings", { method: "PATCH", json: { days: hours } });
      setNote("Working hours saved.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSavingHours(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="danger" title="That did not work">
          <p>{error}</p>
        </Alert>
      ) : null}
      {note ? (
        <Alert tone="success" title="Saved">
          <p>{note}</p>
        </Alert>
      ) : null}

      <form onSubmit={saveSettings} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink">
              <Store className="size-5 text-blush-500" aria-hidden />
              Business details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Business name"
                htmlFor="business-name"
                required
                error={fieldErrors.businessName}
              >
                <Input
                  id="business-name"
                  value={form.businessName}
                  onChange={(event) => setForm({ ...form, businessName: event.target.value })}
                />
              </Field>
              <Field
                label="Business phone"
                htmlFor="business-phone"
                required
                error={fieldErrors.businessPhone}
              >
                <Input
                  id="business-phone"
                  value={form.businessPhone}
                  onChange={(event) => setForm({ ...form, businessPhone: event.target.value })}
                />
              </Field>
              <Field
                label="Business email"
                htmlFor="business-email"
                required
                error={fieldErrors.businessEmail}
              >
                <Input
                  id="business-email"
                  type="email"
                  value={form.businessEmail}
                  onChange={(event) => setForm({ ...form, businessEmail: event.target.value })}
                />
              </Field>
              <Field label="Currency" htmlFor="currency" hint="Prices display as K280 (ZMW).">
                <Input id="currency" value={form.currency} readOnly />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink">
              <Wallet className="size-5 text-blush-500" aria-hidden />
              Deposit &amp; booking rules
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Deposit (K)"
                htmlFor="deposit"
                required
                error={fieldErrors.depositKwacha}
              >
                <Input
                  id="deposit"
                  type="number"
                  min={0}
                  step={5}
                  value={form.depositKwacha}
                  onChange={(event) => setForm({ ...form, depositKwacha: event.target.value })}
                />
              </Field>
              <Field
                label="Slot interval (minutes)"
                htmlFor="slot-interval"
                hint="Gap between start times."
                error={fieldErrors.slotIntervalMinutes}
              >
                <Input
                  id="slot-interval"
                  type="number"
                  min={15}
                  step={15}
                  value={form.slotIntervalMinutes}
                  onChange={(event) =>
                    setForm({ ...form, slotIntervalMinutes: Number(event.target.value) })
                  }
                />
              </Field>
              <Field
                label="Buffer between clients (minutes)"
                htmlFor="buffer"
                hint="Reset and clean-up time."
                error={fieldErrors.bufferMinutes}
              >
                <Input
                  id="buffer"
                  type="number"
                  min={0}
                  step={5}
                  value={form.bufferMinutes}
                  onChange={(event) =>
                    setForm({ ...form, bufferMinutes: Number(event.target.value) })
                  }
                />
              </Field>
              <Field
                label="Booking window (days)"
                htmlFor="window"
                hint="How far ahead customers may book."
                error={fieldErrors.bookingWindowDays}
              >
                <Input
                  id="window"
                  type="number"
                  min={1}
                  value={form.bookingWindowDays}
                  onChange={(event) =>
                    setForm({ ...form, bookingWindowDays: Number(event.target.value) })
                  }
                />
              </Field>
              <Field
                label="Minimum notice (hours)"
                htmlFor="notice"
                error={fieldErrors.minNoticeHours}
              >
                <Input
                  id="notice"
                  type="number"
                  min={0}
                  value={form.minNoticeHours}
                  onChange={(event) =>
                    setForm({ ...form, minNoticeHours: Number(event.target.value) })
                  }
                />
              </Field>
              <Field
                label="Slot hold while paying (minutes)"
                htmlFor="reservation"
                error={fieldErrors.reservationMinutes}
              >
                <Input
                  id="reservation"
                  type="number"
                  min={2}
                  value={form.reservationMinutes}
                  onChange={(event) =>
                    setForm({ ...form, reservationMinutes: Number(event.target.value) })
                  }
                />
              </Field>
              <Field
                label="Maximum bookings per day"
                htmlFor="max-daily"
                error={fieldErrors.maxDailyBookings}
              >
                <Input
                  id="max-daily"
                  type="number"
                  min={1}
                  value={form.maxDailyBookings}
                  onChange={(event) =>
                    setForm({ ...form, maxDailyBookings: Number(event.target.value) })
                  }
                />
              </Field>
            </div>

            <Field
              label="Deposit policy"
              htmlFor="deposit-policy"
              hint="One rule per line. Shown to every customer before payment."
              error={fieldErrors.depositPolicy}
            >
              <Textarea
                id="deposit-policy"
                rows={5}
                value={form.depositPolicy}
                onChange={(event) => setForm({ ...form, depositPolicy: event.target.value })}
              />
            </Field>

            <Field
              label="Cancellation policy"
              htmlFor="cancellation-policy"
              error={fieldErrors.cancellationPolicy}
            >
              <Textarea
                id="cancellation-policy"
                rows={3}
                value={form.cancellationPolicy}
                onChange={(event) =>
                  setForm({ ...form, cancellationPolicy: event.target.value })
                }
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink">
              <Bell className="size-5 text-blush-500" aria-hidden />
              Notifications &amp; reminders
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Toggle
                id="notify-whatsapp"
                label="Send WhatsApp messages"
                checked={form.notifyWhatsapp}
                onChange={(checked) => setForm({ ...form, notifyWhatsapp: checked })}
              />
              <Toggle
                id="notify-sms"
                label="Send SMS messages"
                checked={form.notifySms}
                onChange={(checked) => setForm({ ...form, notifySms: checked })}
              />
              <Toggle
                id="notify-email"
                label="Send email receipts"
                checked={form.notifyEmail}
                onChange={(checked) => setForm({ ...form, notifyEmail: checked })}
              />
              <Toggle
                id="reminder-day-before"
                label="Remind customers 24 hours before"
                checked={form.reminderDayBefore}
                onChange={(checked) => setForm({ ...form, reminderDayBefore: checked })}
              />
            </div>

            <Field
              label="Second reminder (hours before)"
              htmlFor="reminder-hours"
              hint="Set to 0 to switch it off."
              error={fieldErrors.reminderHoursBefore}
            >
              <Input
                id="reminder-hours"
                type="number"
                min={0}
                max={48}
                className="sm:max-w-40"
                value={form.reminderHoursBefore}
                onChange={(event) =>
                  setForm({ ...form, reminderHoursBefore: Number(event.target.value) })
                }
              />
            </Field>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" loading={savingSettings} loadingText="Saving…">
          <Save aria-hidden />
          Save settings
        </Button>
      </form>

      <form onSubmit={saveHours}>
        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink">
              <Clock className="size-5 text-blush-500" aria-hidden />
              Working hours
            </h2>

            <ul className="space-y-2.5">
              {hours.map((day, index) => (
                <li
                  key={day.dayOfWeek}
                  className="grid gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end"
                >
                  <p className="text-sm font-medium text-ink">{WEEKDAYS[day.dayOfWeek]}</p>

                  <Field label="Opens" htmlFor={`open-${day.dayOfWeek}`}>
                    <Input
                      id={`open-${day.dayOfWeek}`}
                      type="time"
                      value={day.openTime}
                      disabled={day.closed}
                      onChange={(event) => {
                        const next = [...hours];
                        next[index] = { ...day, openTime: event.target.value };
                        setHours(next);
                      }}
                    />
                  </Field>

                  <Field label="Closes" htmlFor={`close-${day.dayOfWeek}`}>
                    <Input
                      id={`close-${day.dayOfWeek}`}
                      type="time"
                      value={day.closeTime}
                      disabled={day.closed}
                      onChange={(event) => {
                        const next = [...hours];
                        next[index] = { ...day, closeTime: event.target.value };
                        setHours(next);
                      }}
                    />
                  </Field>

                  <Toggle
                    id={`closed-${day.dayOfWeek}`}
                    label="Closed"
                    checked={day.closed}
                    onChange={(checked) => {
                      const next = [...hours];
                      next[index] = { ...day, closed: checked };
                      setHours(next);
                    }}
                  />
                </li>
              ))}
            </ul>

            <Button type="submit" loading={savingHours} loadingText="Saving…">
              <Save aria-hidden />
              Save working hours
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white p-3 text-sm text-ink"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}
