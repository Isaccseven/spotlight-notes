import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { ScheduledNotification } from "@/types/notification";

export async function registerNotification(
  message: string,
): Promise<ScheduledNotification | null> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  if (!granted) return null;

  return await invoke<ScheduledNotification>("register_notification", {
    message,
  });
}
