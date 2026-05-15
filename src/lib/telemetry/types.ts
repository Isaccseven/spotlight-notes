export interface TelemetryEvent {
  type:
    | "shortcut_trigger"
    | "capture_save"
    | "reminder_scheduled"
    | "reminder_fired"
    | "session_start";
  timestamp: number;
  data?: Record<string, number | string>;
}

export interface DailyStats {
  date: string;
  shortcutTriggers: number;
  captures: number;
  avgCaptureMs: number | null;
  remindersScheduled: number;
  remindersFired: number;
  sessions: number;
}

export interface WeeklyStats {
  startDate: string;
  endDate: string;
  shortcutTriggers: number;
  captures: number;
  avgCaptureMs: number | null;
  remindersScheduled: number;
  remindersFired: number;
  sessions: number;
  repeatCaptureRate: number | null;
  reminderCompletionRate: number | null;
}
