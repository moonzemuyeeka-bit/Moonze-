import { describe, expect, it } from "vitest";
import {
  buildDaySchedule,
  intervalsConflict,
  isSlotBookable,
  type DayScheduleInput,
} from "@/lib/booking/slots";
import { timeToMinutes } from "@/lib/time";

const TODAY = "2026-08-17"; // Monday
const NEXT_MONDAY = "2026-08-24";

/** A normal trading day: 09:00–18:00, half-hour starts, 2-hour set, 15-min buffer. */
function scheduleInput(overrides: Partial<DayScheduleInput> = {}): DayScheduleInput {
  return {
    date: NEXT_MONDAY,
    now: { date: TODAY, minutes: timeToMinutes("08:00") },
    workingHours: { openTime: "09:00", closeTime: "18:00", closed: false },
    serviceDurationMinutes: 120,
    slotIntervalMinutes: 30,
    bufferMinutes: 15,
    busy: [],
    bookingsOnDate: 0,
    maxDailyBookings: 6,
    bookingWindowDays: 60,
    minNoticeHours: 2,
    ...overrides,
  };
}

function busy(startTime: string, endTime: string, bookingId = "booking-1") {
  return {
    bookingId,
    startMinutes: timeToMinutes(startTime),
    endMinutes: timeToMinutes(endTime),
  };
}

function openTimes(input: DayScheduleInput): string[] {
  return buildDaySchedule(input)
    .slots.filter((slot) => slot.available)
    .map((slot) => slot.startTime);
}

describe("interval conflicts", () => {
  it("treats the buffer as part of the appointment", () => {
    const candidate = { startMinutes: timeToMinutes("11:00"), endMinutes: timeToMinutes("13:00") };
    expect(intervalsConflict(candidate, busy("09:00", "11:00"), 15)).toBe(true);
    expect(intervalsConflict(candidate, busy("09:00", "10:45"), 15)).toBe(false);
    expect(intervalsConflict(candidate, busy("09:00", "11:00"), 0)).toBe(false);
  });
});

describe("day schedule", () => {
  it("offers every start time that fits inside working hours", () => {
    const schedule = buildDaySchedule(scheduleInput());
    expect(schedule.dayStatus).toBe("AVAILABLE");
    expect(schedule.slots[0].startTime).toBe("09:00");
    expect(schedule.slots.at(-1)?.startTime).toBe("16:00");
    expect(schedule.availableSlots).toBe(schedule.totalSlots);
  });

  it("never offers a start time that would run past closing", () => {
    const schedule = buildDaySchedule(scheduleInput({ serviceDurationMinutes: 180 }));
    expect(schedule.slots.at(-1)?.startTime).toBe("15:00");
  });

  it("marks a taken time as booked and keeps the rest of the day open", () => {
    const input = scheduleInput({ busy: [busy("11:00", "13:00")] });
    const schedule = buildDaySchedule(input);
    const eleven = schedule.slots.find((slot) => slot.startTime === "11:00");

    expect(eleven?.available).toBe(false);
    expect(eleven?.reason).toBe("Booked");
    expect(schedule.dayStatus).toBe("LIMITED");
    expect(openTimes(input)).toEqual([
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
    ]);
  });

  it("respects the buffer when deciding the next free start time", () => {
    // 2-hour appointment at 09:00 plus a 15-minute buffer: the next start is 11:15.
    const times = openTimes(
      scheduleInput({ slotIntervalMinutes: 15, busy: [busy("09:00", "11:00")] }),
    );
    expect(times[0]).toBe("11:15");
  });

  it("closes the whole day when the owner blocks the date", () => {
    const schedule = buildDaySchedule(
      scheduleInput({ dayOverride: { status: "UNAVAILABLE", reason: "Personal day" } }),
    );
    expect(schedule.dayStatus).toBe("UNAVAILABLE");
    expect(schedule.reason).toBe("Personal day");
    expect(schedule.slots).toHaveLength(0);
  });

  it("closes days the salon does not trade", () => {
    const schedule = buildDaySchedule(
      scheduleInput({ workingHours: { openTime: "09:00", closeTime: "16:00", closed: true } }),
    );
    expect(schedule.dayStatus).toBe("UNAVAILABLE");
    expect(schedule.slots).toHaveLength(0);
  });

  it("stops offering times once the daily booking cap is reached", () => {
    const schedule = buildDaySchedule(
      scheduleInput({ bookingsOnDate: 6, maxDailyBookings: 6, busy: [busy("09:00", "11:00")] }),
    );
    expect(schedule.availableSlots).toBe(0);
    expect(schedule.dayStatus).toBe("FULL");
    expect(schedule.slots.some((slot) => slot.reason === "Day fully booked")).toBe(true);
  });

  it("rejects dates in the past", () => {
    const schedule = buildDaySchedule(scheduleInput({ date: "2026-08-10" }));
    expect(schedule.dayStatus).toBe("PAST");
    expect(schedule.slots).toHaveLength(0);
  });

  it("rejects dates beyond the booking window", () => {
    const schedule = buildDaySchedule(
      scheduleInput({ date: "2026-12-01", bookingWindowDays: 60 }),
    );
    expect(schedule.dayStatus).toBe("UNAVAILABLE");
    expect(schedule.reason).toMatch(/60 days ahead/);
  });

  it("enforces minimum notice on today's remaining times", () => {
    const schedule = buildDaySchedule(
      scheduleInput({
        date: TODAY,
        now: { date: TODAY, minutes: timeToMinutes("10:00") },
        minNoticeHours: 2,
      }),
    );
    const times = schedule.slots.filter((slot) => slot.available).map((slot) => slot.startTime);

    expect(times[0]).toBe("12:00");
    expect(schedule.slots.find((slot) => slot.startTime === "11:30")?.reason).toBe("Too soon");
  });

  it("uses hand-crafted slots instead of the generated grid when the owner adds them", () => {
    const times = openTimes(
      scheduleInput({
        explicitSlots: [
          { startTime: "10:00", endTime: "12:00", status: "OPEN" },
          { startTime: "13:00", endTime: "15:00", status: "BLOCKED" },
          { startTime: "15:30", endTime: "17:30", status: "OPEN" },
        ],
      }),
    );
    expect(times).toEqual(["10:00", "15:30"]);
  });

  it("lets a booking re-check the slot it already holds", () => {
    const input = scheduleInput({ busy: [busy("11:00", "13:00", "mine")] });
    expect(isSlotBookable(input, "11:00")).toBe(false);
    expect(isSlotBookable({ ...input, ignoreBookingId: "mine" }, "11:00")).toBe(true);
  });

  it("answers the single-slot question the same way as the day view", () => {
    const input = scheduleInput({ busy: [busy("11:00", "13:00")] });
    expect(isSlotBookable(input, "14:00")).toBe(true);
    expect(isSlotBookable(input, "11:00")).toBe(false);
    expect(isSlotBookable(input, "09:45")).toBe(false); // not on the grid at all
  });
});
