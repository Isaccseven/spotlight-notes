import { debug } from "@tauri-apps/plugin-log";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

async function ensurePermission() {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  return granted;
}

function parseDelayMs(message: string): number | null {
  const partAfterAt = message.split("@")[1];
  if (!partAfterAt) return null;

  const match = partAfterAt.trim().match(/^(\d+)([smhd])/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const unitToMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * unitToMs[unit];
}

export async function registerNotification(message: string) {
  if (!(await ensurePermission())) return;

  const delay = parseDelayMs(message);
  await debug(`Notification scheduled: ${message}, delay: ${delay}ms`);
  if (delay == null) return;

  const body = message.split("@")[0].trim();
  setTimeout(() => {
    sendNotification({ title: "mac Quick Note", body });
  }, delay);
}
