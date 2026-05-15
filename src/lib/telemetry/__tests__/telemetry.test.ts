import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getEvents,
  logEvent,
  getDailyStats,
  getWeeklyStats,
} from "@/lib/telemetry/telemetry";
import { TelemetryEvent } from "@/lib/telemetry/types";
import { store } from "@/lib/store/store";

vi.mock("@/lib/store/store", () => ({
  store: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(store.get).mockResolvedValue(null);
  });

  it("getEvents returns empty array when no events stored", async () => {
    const events = await getEvents();
    expect(events).toEqual([]);
  });

  it("logEvent stores a new event", async () => {
    const event: TelemetryEvent = {
      type: "shortcut_trigger",
      timestamp: Date.now(),
    };
    await logEvent(event);
    expect(store.set).toHaveBeenCalled();
    const calls = vi.mocked(store.set).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toHaveLength(1);
    expect((lastCall[1] as TelemetryEvent[])[0].type).toBe("shortcut_trigger");
  });

  it("getDailyStats computes stats for a given day", () => {
    const date = "2026-05-15";
    const base = new Date(date).getTime();
    const events: TelemetryEvent[] = [
      { type: "shortcut_trigger", timestamp: base },
      { type: "capture_save", timestamp: base + 1000, data: { durationMs: 500 } },
      { type: "capture_save", timestamp: base + 2000, data: { durationMs: 700 } },
      { type: "reminder_scheduled", timestamp: base + 3000 },
      { type: "session_start", timestamp: base, data: { sessionId: "s1" } },
    ];

    const stats = getDailyStats(events, date);
    expect(stats.shortcutTriggers).toBe(1);
    expect(stats.captures).toBe(2);
    expect(stats.avgCaptureMs).toBe(600);
    expect(stats.remindersScheduled).toBe(1);
    expect(stats.sessions).toBe(1);
  });

  it("getDailyStats returns zeroes for empty day", () => {
    const stats = getDailyStats([], "2026-05-15");
    expect(stats.captures).toBe(0);
    expect(stats.avgCaptureMs).toBeNull();
  });

  it("getWeeklyStats aggregates over 7 days", () => {
    const endDate = "2026-05-15";
    const base = new Date(endDate).getTime();
    const events: TelemetryEvent[] = [
      { type: "shortcut_trigger", timestamp: base },
      { type: "capture_save", timestamp: base, data: { durationMs: 400 } },
      { type: "session_start", timestamp: base, data: { sessionId: "s1" } },
      { type: "capture_save", timestamp: base, data: { sessionId: "s1" } },
      { type: "capture_save", timestamp: base, data: { sessionId: "s1" } },
    ];

    const stats = getWeeklyStats(events, endDate);
    expect(stats.captures).toBe(3);
    expect(stats.sessions).toBe(1);
    expect(stats.repeatCaptureRate).toBe(100);
  });

  it("prunes events older than 90 days on log", async () => {
    const now = Date.now();
    const oldEvent: TelemetryEvent = {
      type: "shortcut_trigger",
      timestamp: now - 100 * 24 * 60 * 60 * 1000,
    };
    vi.mocked(store.get).mockResolvedValue([oldEvent]);
    await logEvent({ type: "shortcut_trigger", timestamp: now });
    const calls = vi.mocked(store.set).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toHaveLength(1);
    expect((lastCall[1] as TelemetryEvent[])[0].timestamp).toBe(now);
  });
});
