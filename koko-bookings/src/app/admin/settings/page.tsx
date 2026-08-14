import { SettingsPanel } from "@/components/admin/settings-panel";
import { requireAdminPage } from "@/lib/auth/guard";
import { getBusinessConfig } from "@/lib/database/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage("/admin/settings");
  const config = await getBusinessConfig();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Business settings</h1>
        <p className="text-sm text-ink-soft">
          Deposit, booking rules, policies and working hours. Changes apply to every new
          booking straight away — appointments already in the diary keep the policy they
          were booked under.
        </p>
      </div>

      <SettingsPanel
        settings={{
          businessName: config.businessName,
          businessPhone: config.businessPhone,
          businessEmail: config.businessEmail,
          currency: config.currency,
          depositNgwee: config.depositNgwee,
          slotIntervalMinutes: config.slotIntervalMinutes,
          bufferMinutes: config.bufferMinutes,
          bookingWindowDays: config.bookingWindowDays,
          minNoticeHours: config.minNoticeHours,
          reservationMinutes: config.reservationMinutes,
          maxDailyBookings: config.maxDailyBookings,
          depositPolicy: config.depositPolicy,
          cancellationPolicy: config.cancellationPolicy,
          notifyWhatsapp: config.notifyWhatsapp,
          notifySms: config.notifySms,
          notifyEmail: config.notifyEmail,
          reminderDayBefore: config.reminderDayBefore,
          reminderHoursBefore: config.reminderHoursBefore,
        }}
        workingHours={config.workingHours.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          openTime: day.openTime,
          closeTime: day.closeTime,
          closed: day.closed,
        }))}
      />
    </div>
  );
}
