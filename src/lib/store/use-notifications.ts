import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ScheduledNotification } from "@/types/notification";

export function useNotifications() {
  const [pending, setPending] = useState<ScheduledNotification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<ScheduledNotification[]>(
        "list_pending_notifications",
      );
      setPending(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const cancel = useCallback(
    async (id: string) => {
      try {
        await invoke("cancel_notification", { id });
        await refresh();
      } catch (e) {
        console.error(e);
      }
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);

    let unlistenFired: (() => void) | undefined;
    let unlistenScheduled: (() => void) | undefined;

    const setupListeners = async () => {
      const unlisten1 = await listen<ScheduledNotification>("reminder_fired", () => {
        refresh();
      });
      unlistenFired = unlisten1;

      const unlisten2 = await listen<ScheduledNotification>("reminder_scheduled", (event) => {
        setPending((prev) => [...prev, event.payload]);
      });
      unlistenScheduled = unlisten2;
    };
    setupListeners();

    return () => {
      clearInterval(interval);
      if (unlistenFired) unlistenFired();
      if (unlistenScheduled) unlistenScheduled();
    };
  }, [refresh]);

  return { pending, refresh, cancel };
}
