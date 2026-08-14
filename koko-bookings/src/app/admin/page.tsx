import Link from "next/link";
import {
  BanknoteArrowDown,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Clock,
  Hourglass,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminPage } from "@/lib/auth/guard";
import { BOOKING_STATUS_LABEL } from "@/lib/booking/booking-service";
import { expireReservations } from "@/lib/booking/booking-service";
import {
  getDashboardStats,
  getNextAppointment,
  getRevenueTrend,
  getServicePerformance,
  getTodaysSchedule,
} from "@/lib/database/reporting";
import { formatKwacha } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { dbDateToDateKey, formatDateLong, formatDateShort } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage("/admin");
  await expireReservations();

  const [stats, schedule, next, trend, performance] = await Promise.all([
    getDashboardStats(),
    getTodaysSchedule(),
    getNextAppointment(),
    getRevenueTrend(),
    getServicePerformance(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Today at a glance</h1>
          <p className="text-sm text-ink-soft">{formatDateLong(stats.today)}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/calendar">Open calendar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/bookings">Manage bookings</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Today's appointments"
          value={`${stats.todaysAppointments}`}
          hint={
            stats.todaysAppointments === 1 ? "1 appointment" : `${stats.todaysAppointments} appointments`
          }
          Icon={CalendarCheck}
        />
        <StatCard
          label="Upcoming appointments"
          value={`${stats.upcomingAppointments}`}
          hint="Confirmed, after today"
          Icon={CalendarClock}
        />
        <StatCard
          label="Deposits collected"
          value={formatKwacha(stats.depositsCollectedTodayNgwee)}
          hint={`${formatKwacha(stats.depositsCollectedAllTimeNgwee)} all time`}
          Icon={BanknoteArrowDown}
          tone="success"
        />
        <StatCard
          label="Available slots today"
          value={`${stats.availableSlotsToday}`}
          hint="Start times still open"
          Icon={Clock}
        />
        <StatCard
          label="Cancelled this month"
          value={`${stats.cancelledThisMonth}`}
          hint={`${stats.noShowsThisMonth} no-show${stats.noShowsThisMonth === 1 ? "" : "s"}`}
          Icon={CalendarX}
          tone={stats.cancelledThisMonth > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Checkouts in progress"
          value={`${stats.pendingPayments}`}
          hint="Slots held while customers pay"
          Icon={Hourglass}
          tone={stats.pendingPayments > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl text-ink">Revenue</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="text-ink-soft">
                  Today{" "}
                  <span className="font-medium text-ink">
                    {formatKwacha(stats.revenue.todayNgwee)}
                  </span>
                </span>
                <span className="text-ink-soft">
                  This week{" "}
                  <span className="font-medium text-ink">
                    {formatKwacha(stats.revenue.weekNgwee)}
                  </span>
                </span>
                <span className="text-ink-soft">
                  This month{" "}
                  <span className="font-medium text-ink">
                    {formatKwacha(stats.revenue.monthNgwee)}
                  </span>
                </span>
              </div>
            </div>

            <RevenueChart data={trend} />

            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <TrendingUp className="size-3.5" aria-hidden />
              Completed services plus deposits kept from no-shows. Expected for this month:{" "}
              {formatKwacha(stats.revenue.expectedMonthNgwee)}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5 pt-5">
            <h2 className="font-display text-xl text-ink">Next appointment</h2>
            {next ? (
              <div className="space-y-1.5">
                <p className="font-display text-2xl text-blush-800">{next.startTime}</p>
                <p className="text-sm font-medium text-ink">{next.customer.name}</p>
                <p className="text-sm text-ink-soft">{next.serviceName}</p>
                <p className="text-xs text-ink-muted">
                  {formatDateShort(dbDateToDateKey(next.appointmentDate))} ·{" "}
                  {formatPhone(next.customer.phone)}
                </p>
                <Badge tone="success" className="mt-2">
                  Balance {formatKwacha(next.remainingNgwee)} due
                </Badge>
              </div>
            ) : (
              <EmptyState title="No upcoming appointments yet." />
            )}

            <div className="space-y-2 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <Users className="size-4 text-blush-500" aria-hidden />
                Customers
              </p>
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <UserPlus className="size-4 text-blush-400" aria-hidden />
                {stats.newCustomersThisMonth} new this month
              </p>
              <Button asChild variant="secondary" size="sm" full>
                <Link href="/admin/customers">View customers</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5 pt-5">
            <h2 className="font-display text-xl text-ink">Today&apos;s schedule</h2>
            {schedule.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck />}
                title="No appointments today."
                description="Blocked the day off? You can reopen it from the calendar."
              />
            ) : (
              <ul className="divide-y divide-line">
                {schedule.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {booking.startTime} · {booking.customer.name}
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        {booking.serviceName} · {formatPhone(booking.customer.phone)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        booking.status === "COMPLETED"
                          ? "brand"
                          : booking.status === "NO_SHOW"
                            ? "danger"
                            : "success"
                      }
                    >
                      {BOOKING_STATUS_LABEL[booking.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5 pt-5">
            <h2 className="font-display text-xl text-ink">Services this month</h2>
            {performance.length === 0 ? (
              <EmptyState title="No bookings yet this month." />
            ) : (
              <ul className="space-y-2.5">
                {performance.map((row) => (
                  <li key={row.serviceName} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">{row.serviceName}</span>
                      <span className="font-medium text-ink">
                        {formatKwacha(row.valueNgwee)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-blush-100">
                      <div
                        className="h-full rounded-full bg-blush-400"
                        style={{
                          width: `${Math.round(
                            (row.valueNgwee /
                              Math.max(...performance.map((entry) => entry.valueNgwee))) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-ink-muted">
                      {row.bookings} booking{row.bookings === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
