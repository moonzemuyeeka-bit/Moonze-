import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  addMonths,
  businessNow,
  dateKeyToDbDate,
  dayOfWeekForDateKey,
  daysBetweenDateKeys,
  daysInMonth,
  dbDateToDateKey,
  formatDateLong,
  formatDuration,
  instantToDateKey,
  instantToTime,
  isDateKey,
  isTimeString,
  minutesToTime,
  minutesUntil,
  timeToMinutes,
  zonedToInstant,
} from "@/lib/time";

describe("time helpers", () => {
  it("validates date keys and times", () => {
    expect(isDateKey("2026-08-15")).toBe(true);
    expect(isDateKey("15-08-2026")).toBe(false);
    expect(isTimeString("14:00")).toBe(true);
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("9:00")).toBe(false);
  });

  it("converts between HH:mm and minutes", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("14:30")).toBe(870);
    expect(minutesToTime(870)).toBe("14:30");
    expect(minutesToTime(675)).toBe("11:15");
  });

  it("maps a Lusaka wall-clock time to the right UTC instant", () => {
    // Africa/Lusaka is UTC+2 all year (no daylight saving).
    expect(zonedToInstant("2026-08-15", "14:00").toISOString()).toBe(
      "2026-08-15T12:00:00.000Z",
    );
    expect(instantToDateKey(new Date("2026-08-15T22:30:00.000Z"))).toBe("2026-08-16");
    expect(instantToTime(new Date("2026-08-15T12:00:00.000Z"))).toBe("14:00");
  });

  it("reports the business's own clock", () => {
    const now = businessNow("Africa/Lusaka", new Date("2026-08-15T06:15:00.000Z"));
    expect(now.date).toBe("2026-08-15");
    expect(now.time).toBe("08:15");
    expect(now.minutes).toBe(495);
  });

  it("round-trips calendar dates through Postgres DATE columns", () => {
    expect(dateKeyToDbDate("2026-08-15").toISOString()).toBe("2026-08-15T00:00:00.000Z");
    expect(dbDateToDateKey(new Date("2026-08-15T00:00:00.000Z"))).toBe("2026-08-15");
  });

  it("does arithmetic on calendar days", () => {
    expect(addDaysToDateKey("2026-08-30", 3)).toBe("2026-09-02");
    expect(daysBetweenDateKeys("2026-08-15", "2026-08-18")).toBe(3);
    expect(daysBetweenDateKeys("2026-08-18", "2026-08-15")).toBe(-3);
    expect(dayOfWeekForDateKey("2026-08-16")).toBe(0); // Sunday
    expect(daysInMonth("2026-02")).toBe(28);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("formats for customers", () => {
    expect(formatDateLong("2026-08-15")).toBe("15 August 2026");
    expect(formatDuration(120)).toBe("2 hours");
    expect(formatDuration(90)).toBe("1 hour 30 minutes");
    expect(formatDuration(45)).toBe("45 minutes");
  });

  it("counts down to an instant and never goes negative", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    expect(minutesUntil(new Date("2026-08-15T12:09:30.000Z"), now)).toBe(10);
    expect(minutesUntil(new Date("2026-08-15T11:00:00.000Z"), now)).toBe(0);
  });
});
