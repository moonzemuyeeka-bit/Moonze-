"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { CalendarDayDto, DaySlotsDto } from "@/types";

type MonthResponse = { month: string; days: CalendarDayDto[] };
type SlotsResponse = DaySlotsDto & { suggestions: string[] };

/** Month calendar data for the selected service. */
export function useMonthAvailability(serviceId: string | null, month: string) {
  const [days, setDays] = useState<CalendarDayDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<MonthResponse>(
        `/api/availability?month=${month}&serviceId=${serviceId}`,
      );
      setDays(data.days);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "We could not load the calendar. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [month, serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { days, loading, error, reload: load };
}

/** Time slots for one date, re-checked whenever the customer returns to it. */
export function useDaySlots(serviceId: string | null, date: string | null) {
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!serviceId || !date) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(
        await apiRequest<SlotsResponse>(
          `/api/availability/slots?date=${date}&serviceId=${serviceId}`,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "We could not check availability. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [date, serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
