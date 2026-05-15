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

    let unlistenFn: (() => void) | undefined;
    const setupListener = async () => {
      const unlisten = await listen("reminder_fired", () => {
        refresh();
      });
      unlistenFn = unlisten;
    };
    setupListener();

    return () => {
      clearInterval(interval);
      if (unlistenFn) unlistenFn();
    };
  }, [refresh]);

  return { pending, refresh, cancel };
}
