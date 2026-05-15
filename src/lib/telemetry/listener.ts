import { listen } from "@tauri-apps/api/event";
import { logEvent } from "@/lib/telemetry/telemetry";

let unlistenFn: (() => void) | null = null;

export async function initTelemetryListeners(): Promise<void> {
  if (unlistenFn) return;
  const unlisten = await listen<string>("reminder_fired", () => {
    logEvent({
      type: "reminder_fired",
      timestamp: Date.now(),
    });
  });
  unlistenFn = unlisten;
}
