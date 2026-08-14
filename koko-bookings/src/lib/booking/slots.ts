import {
  daysBetweenDateKeys,
  minutesToTime,
  timeToMinutes,
  type DateKey,
  type TimeString,
} from "@/lib/time";
import type { DayStatus, SlotDto } from "@/types";

/**
 * The scheduling engine, deliberately kept pure: given the shape of a day and
 * what is already booked, it decides which start times a customer may pick.
 * Every availability question in the app (calendar colours, the time grid, and
 * the final server-side re-check before payment) is answered here, so they can
 * never disagree with each other.
 */

export type BusyInterval = {
  startMinutes: number;
  endMinutes: number;
  /** Excluded when re-checking the slot a booking already holds. */
  bookingId?: string;
};

export type DayWorkingHours = {
  openTime: TimeString;
  closeTime: TimeString;
  closed: boolean;
};

export type ExplicitSlot = {
  startTime: TimeString;
  endTime: TimeString;
  status: "OPEN" | "BLOCKED";
};

export type DayOverride = {
  status: "AVAILABLE" | "UNAVAILABLE";
  reason?: string | null;
};

export type DayScheduleInput = {
  date: DateKey;
  now: { date: DateKey; minutes: number };
  workingHours: DayWorkingHours | null;
  explicitSlots?: ExplicitSlot[];
  dayOverride?: DayOverride | null;
  serviceDurationMinutes: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  busy: BusyInterval[];
  bookingsOnDate: number;
  maxDailyBookings: number;
  bookingWindowDays: number;
  minNoticeHours: number;
  /** Set when re-checking availability for an existing booking. */
  ignoreBookingId?: string;
};

export type DaySchedule = {
  date: DateKey;
  dayStatus: DayStatus;
  reason: string | null;
  slots: SlotDto[];
  totalSlots: number;
  availableSlots: number;
};

const SLOT_REASONS = {
  booked: "Booked",
  past: "Too late",
  notice: "Too soon",
  closed: "Closed",
  dayFull: "Day fully booked",
} as const;

/** Two appointments clash when their intervals overlap once buffers are added. */
export function intervalsConflict(
  candidate: { startMinutes: number; endMinutes: number },
  busy: { startMinutes: number; endMinutes: number },
  bufferMinutes: number,
): boolean {
  return (
    candidate.startMinutes < busy.endMinutes + bufferMinutes &&
    busy.startMinutes < candidate.endMinutes + bufferMinutes
  );
}

function candidateStarts(input: DayScheduleInput): {
  starts: number[];
  windowEnd: number;
} {
  const explicit = input.explicitSlots ?? [];

  // A hand-crafted day (admin-created slots) replaces the generated grid.
  if (explicit.length > 0) {
    const open = explicit.filter((slot) => slot.status === "OPEN");
    const windowEnd = explicit.reduce(
      (latest, slot) => Math.max(latest, timeToMinutes(slot.endTime)),
      0,
    );
    return {
      starts: open.map((slot) => timeToMinutes(slot.startTime)).sort((a, b) => a - b),
      windowEnd: Math.max(windowEnd, input.workingHours && !input.workingHours.closed
        ? timeToMinutes(input.workingHours.closeTime)
        : 0),
    };
  }

  if (!input.workingHours || input.workingHours.closed) {
    return { starts: [], windowEnd: 0 };
  }

  const open = timeToMinutes(input.workingHours.openTime);
  const close = timeToMinutes(input.workingHours.closeTime);
  const step = Math.max(15, input.slotIntervalMinutes);
  const starts: number[] = [];

  for (let start = open; start + input.serviceDurationMinutes <= close; start += step) {
    starts.push(start);
  }
  return { starts, windowEnd: close };
}

export function buildDaySchedule(input: DayScheduleInput): DaySchedule {
  const daysAhead = daysBetweenDateKeys(input.now.date, input.date);

  if (daysAhead < 0) {
    return emptyDay(input.date, "PAST", "This date has passed");
  }
  if (daysAhead > input.bookingWindowDays) {
    return emptyDay(
      input.date,
      "UNAVAILABLE",
      `Bookings open ${input.bookingWindowDays} days ahead`,
    );
  }
  if (input.dayOverride?.status === "UNAVAILABLE") {
    return emptyDay(input.date, "UNAVAILABLE", input.dayOverride.reason ?? "Unavailable");
  }

  const { starts, windowEnd } = candidateStarts(input);
  if (starts.length === 0) {
    return emptyDay(input.date, "UNAVAILABLE", SLOT_REASONS.closed);
  }

  const busy = input.busy.filter(
    (interval) => !input.ignoreBookingId || interval.bookingId !== input.ignoreBookingId,
  );
  const dayIsFull = input.bookingsOnDate >= input.maxDailyBookings;
  const earliestStart =
    daysAhead === 0 ? input.now.minutes + input.minNoticeHours * 60 : -Infinity;

  const slots: SlotDto[] = starts.map((startMinutes) => {
    const endMinutes = startMinutes + input.serviceDurationMinutes;
    const slot: SlotDto = {
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      available: true,
    };

    if (windowEnd > 0 && endMinutes > windowEnd) {
      return { ...slot, available: false, reason: SLOT_REASONS.closed };
    }
    if (startMinutes < earliestStart) {
      return {
        ...slot,
        available: false,
        reason: daysAhead === 0 ? SLOT_REASONS.notice : SLOT_REASONS.past,
      };
    }
    if (
      busy.some((interval) =>
        intervalsConflict({ startMinutes, endMinutes }, interval, input.bufferMinutes),
      )
    ) {
      return { ...slot, available: false, reason: SLOT_REASONS.booked };
    }
    if (dayIsFull) {
      return { ...slot, available: false, reason: SLOT_REASONS.dayFull };
    }
    return slot;
  });

  const availableSlots = slots.filter((slot) => slot.available).length;
  const dayStatus: DayStatus =
    availableSlots === 0
      ? dayIsFull || busy.length > 0
        ? "FULL"
        : "UNAVAILABLE"
      : availableSlots < slots.length
        ? "LIMITED"
        : "AVAILABLE";

  return {
    date: input.date,
    dayStatus,
    reason:
      dayStatus === "FULL"
        ? "Fully booked"
        : dayStatus === "UNAVAILABLE"
          ? "No available times"
          : null,
    slots,
    totalSlots: slots.length,
    availableSlots,
  };
}

/** True when a specific start time may be booked — the pre-payment re-check. */
export function isSlotBookable(input: DayScheduleInput, startTime: TimeString): boolean {
  const schedule = buildDaySchedule(input);
  return schedule.slots.some((slot) => slot.startTime === startTime && slot.available);
}

function emptyDay(date: DateKey, status: DayStatus, reason: string): DaySchedule {
  return { date, dayStatus: status, reason, slots: [], totalSlots: 0, availableSlots: 0 };
}

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  AVAILABLE: "Available",
  LIMITED: "Limited availability",
  FULL: "Fully booked",
  UNAVAILABLE: "Unavailable",
  PAST: "Past",
};
