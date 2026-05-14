import { register } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEBOUNCE_DELAY, GLOBAL_SHORTCUTS_KEY } from "@/lib/shortcut/constants";

let lastTrigger = 0;

export async function registerShortcut() {
  try {
    const appWindow = getCurrentWindow();

    await register(GLOBAL_SHORTCUTS_KEY, async () => {
      const now = Date.now();
      if (now - lastTrigger < DEBOUNCE_DELAY) return;
      lastTrigger = now;

      try {
        const visible = await appWindow.isVisible();
        if (visible) {
          await appWindow.hide();
        } else {
          await appWindow.show();
          await appWindow.setFocus();
        }
      } catch (error) {}
    });
  } catch (error) {
    retryRegister();
  }
}

function retryRegister() {
  setTimeout(() => {
    registerShortcut();
  }, 2000);
}

// Register immediately
registerShortcut();
