import { store } from "@/lib/store/store";
import {
  TelemetryEvent,
  DailyStats,
  WeeklyStats,
} from "@/lib/telemetry/types";

export const TELEMETRY_KEY = "telemetry_events";
const RETENTION_DAYS = 90;

export async function getEvents(): Promise<TelemetryEvent[]> {
  const events = await store.get<TelemetryEvent[]>(TELEMETRY_KEY);
  return events ?? [];
}

export async function logEvent(event: TelemetryEvent): Promise<void> {
  const events = await getEvents();
  events.push(event);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pruned = events.filter((e) => e.timestamp >= cutoff);
  await store.set(TELEMETRY_KEY, pruned);
}

function toISODate(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0];
}

export function getDailyStats(
  events: TelemetryEvent[],
  date: string,
): DailyStats {
  const dayEvents = events.filter((e) => toISODate(e.timestamp) === date);

  const shortcutTriggers = dayEvents.filter(
    (e) => e.type === "shortcut_trigger",
  ).length;
  const captures = dayEvents.filter((e) => e.type === "capture_save").length;
  const captureTimes = dayEvents
    .filter((e) => e.type === "capture_save" && e.data?.durationMs != null)
    .map((e) => Number(e.data!.durationMs));
  const avgCaptureMs =
    captureTimes.length > 0
      ? Math.round(
          captureTimes.reduce((a, b) => a + b, 0) / captureTimes.length,
        )
      : null;

  const remindersScheduled = dayEvents.filter(
    (e) => e.type === "reminder_scheduled",
  ).length;
  const remindersFired = dayEvents.filter(
    (e) => e.type === "reminder_fired",
  ).length;
  const sessions = dayEvents.filter((e) => e.type === "session_start").length;

  return {
    date,
    shortcutTriggers,
    captures,
    avgCaptureMs,
    remindersScheduled,
    remindersFired,
    sessions,
  };
}

export function getWeeklyStats(
  events: TelemetryEvent[],
  endDate: string,
): WeeklyStats {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  let shortcutTriggers = 0;
  let captures = 0;
  let captureSum = 0;
  let captureCount = 0;
  let remindersScheduled = 0;
  let remindersFired = 0;
  let sessions = 0;

  const sessionCaptures = new Map<string, number>();

  for (let i = 0; i <= 6; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = toISODate(d.getTime());
    const day = getDailyStats(events, iso);
    shortcutTriggers += day.shortcutTriggers;
    captures += day.captures;
    if (day.avgCaptureMs != null) {
      captureSum += day.avgCaptureMs * day.captures;
      captureCount += day.captures;
    }
    remindersScheduled += day.remindersScheduled;
    remindersFired += day.remindersFired;
    sessions += day.sessions;
  }

  for (const e of events) {
    const ts = e.timestamp;
    if (ts < start.getTime() || ts > end.getTime() + 24 * 60 * 60 * 1000)
      continue;
    if (e.type === "session_start" && e.data?.sessionId) {
      sessionCaptures.set(e.data.sessionId as string, 0);
    }
    if (e.type === "capture_save" && e.data?.sessionId) {
      const id = e.data.sessionId as string;
      sessionCaptures.set(id, (sessionCaptures.get(id) ?? 0) + 1);
    }
  }

  const sessionValues = Array.from(sessionCaptures.values());
  const repeatCaptureRate =
    sessionValues.length > 0
      ? Math.round(
          (sessionValues.filter((c) => c >= 2).length / sessionValues.length) *
            100,
        )
      : null;

  const reminderCompletionRate =
    remindersScheduled > 0
      ? Math.round((remindersFired / remindersScheduled) * 100)
      : null;

  return {
    startDate: toISODate(start.getTime()),
    endDate,
    shortcutTriggers,
    captures,
    avgCaptureMs: captureCount > 0 ? Math.round(captureSum / captureCount) : null,
    remindersScheduled,
    remindersFired,
    sessions,
    repeatCaptureRate,
    reminderCompletionRate,
  };
}
