import { useState, useEffect, useCallback } from "react";
import { getEvents, getDailyStats, getWeeklyStats } from "@/lib/telemetry/telemetry";
import { TelemetryEvent } from "@/lib/telemetry/types";

export function useTelemetry() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ev = await getEvents();
      setEvents(ev);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const today = new Date().toISOString().split("T")[0];
  const daily = getDailyStats(events, today);
  const weekly = getWeeklyStats(events, today);

  const totalCaptures = events.filter((e) => e.type === "capture_save").length;
  const totalShortcuts = events.filter(
    (e) => e.type === "shortcut_trigger",
  ).length;

  return {
    events,
    loading,
    refresh,
    daily,
    weekly,
    totalCaptures,
    totalShortcuts,
  };
}
