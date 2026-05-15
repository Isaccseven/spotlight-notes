import { logEvent } from "@/lib/telemetry/telemetry";

let activeSessionId: string | null = null;
let activeSessionStart: number = 0;
let lastShortcutTime: number = 0;

export function startShortcutSession(): void {
  const now = Date.now();
  lastShortcutTime = now;
  activeSessionId = crypto.randomUUID();
  activeSessionStart = now;
  logEvent({
    type: "shortcut_trigger",
    timestamp: now,
  });
  logEvent({
    type: "session_start",
    timestamp: now,
    data: { sessionId: activeSessionId },
  });
}

export function getActiveSession(): { id: string; start: number } | null {
  if (!activeSessionId) return null;
  return { id: activeSessionId, start: activeSessionStart };
}

export function clearSession(): void {
  activeSessionId = null;
  activeSessionStart = 0;
}

export function getLastShortcutTime(): number {
  return lastShortcutTime;
}
