import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@tauri-apps/plugin-log", () => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockAppWindow = {
  hide: vi.fn().mockResolvedValue(undefined),
  show: vi.fn().mockResolvedValue(undefined),
  setFocus: vi.fn().mockResolvedValue(undefined),
  isVisible: vi.fn().mockResolvedValue(true),
  onFocusChanged: vi.fn().mockReturnValue(Promise.resolve(vi.fn())),
};

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn().mockReturnValue(mockAppWindow),
}));

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  sendNotification: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === "parse_note_command") {
      const text = (args?.text as string) ?? "";
      const rawTags = [...text.matchAll(/#([a-zA-Z0-9_/-]+)/g)].map((m) => m[1].toLowerCase());
      const tagSet = new Set<string>();
      const tags = rawTags.filter((t) => {
        if (tagSet.has(t)) return false;
        tagSet.add(t);
        return true;
      });
      const delays = [...text.matchAll(/@(\d+)([smhd])/gi)].map((m) => {
        const amount = Number(m[1]);
        const unit = m[2].toLowerCase();
        const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
        return amount * (multipliers[unit] ?? 1000);
      });
      const issues = [...text.matchAll(/@issue([a-zA-Z0-9_/-]*)/g)].map((m) => m[1]);
      const channels = [...text.matchAll(/@channel\/([a-zA-Z0-9_/-]+)/g)].map((m) => m[1]);
      const mentions = [...text.matchAll(/@([a-zA-Z0-9_/-]+)/g)]
        .filter((m) => !m[0].startsWith("@issue") && !m[0].startsWith("@channel"))
        .map((m) => m[1]);
      const allChannels = [...channels, ...mentions];
      let clean = text.replace(/#\S+/g, "").replace(/@\S+/g, "").trim();
      clean = clean.replace(/\s+/g, " ").trim();
      return {
        raw: text,
        tokens: [],
        tags,
        delays_ms: delays,
        issues,
        channels: allChannels,
        clean_body: clean,
      };
    }
    if (cmd === "register_notification") {
      return [];
    }
    return undefined;
  }),
}));

const eventListeners = new Map<string, Array<(event: { payload: unknown }) => void>>();

export function emitTestEvent(event: string, payload: unknown): void {
  const handlers = eventListeners.get(event) ?? [];
  handlers.forEach((h) => h({ payload }));
}

export function clearTestEventListeners(): void {
  eventListeners.clear();
}

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, []);
    }
    eventListeners.get(event)!.push(handler);
    return () => {
      const handlers = eventListeners.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    };
  }),
}));
