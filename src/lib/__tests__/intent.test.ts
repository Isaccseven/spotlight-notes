import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  inferIntent,
  readClipboard,
  getDefaultIntentSettings,
  type IntentSettings,
} from "@/lib/intent";
import type { Note } from "@/types/note";

describe("intent inference", () => {
  const makeNote = (text: string, createdAt: number, tags?: string[]): Note => ({
    id: crypto.randomUUID(),
    text,
    createdAt,
    pinned: false,
    tags,
  });

  describe("getDefaultIntentSettings", () => {
    it("has all inference types with expected defaults", () => {
      const defaults = getDefaultIntentSettings();
      expect(defaults.timeOfDayEnabled).toBe(true);
      expect(defaults.lastTagEnabled).toBe(true);
      expect(defaults.clipboardUrlEnabled).toBe(true);
      expect(defaults.calendarEnabled).toBe(false);
    });
  });

  describe("time-of-day", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("suggests morning log between 6am and 11am", () => {
      vi.setSystemTime(new Date("2024-01-15T08:00:00"));
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        lastTagEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent([], settings);
      expect(result).not.toBeNull();
      expect(result!.source).toBe("time-of-day");
      expect(result!.text).toBe("");
      expect(result!.label).toBe("morning log");
    });

    it("suggests evening reminder between 5pm and 10pm", () => {
      vi.setSystemTime(new Date("2024-01-15T19:00:00"));
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        lastTagEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent([], settings);
      expect(result).not.toBeNull();
      expect(result!.source).toBe("time-of-day");
      expect(result!.text).toBe(" @8h");
    });

    it("returns null during midday when no other signals", () => {
      vi.setSystemTime(new Date("2024-01-15T14:00:00"));
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        lastTagEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent([], settings);
      expect(result).toBeNull();
    });
  });

  describe("last-active tag", () => {
    it("carries over the last tag from the most recent note", () => {
      const notes: Note[] = [
        makeNote("idea #work #urgent", 1000, ["work", "urgent"]),
      ];
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent(notes, settings);
      expect(result).not.toBeNull();
      expect(result!.source).toBe("last-tag");
      expect(result!.text).toBe(" #urgent");
    });

    it("extracts tags from text when tags field is missing", () => {
      const notes: Note[] = [makeNote("meeting notes #project", 1000)];
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent(notes, settings);
      expect(result).not.toBeNull();
      expect(result!.text).toBe(" #project");
    });

    it("returns null when there are no notes", () => {
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent([], settings);
      expect(result).toBeNull();
    });

    it("returns null when the most recent note has no tags", () => {
      const notes: Note[] = [makeNote("just text", 1000)];
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent(notes, settings);
      expect(result).toBeNull();
    });

    it("uses the most recent note by createdAt", () => {
      const notes: Note[] = [
        makeNote("older #old", 500, ["old"]),
        makeNote("newer #new", 1000, ["new"]),
      ];
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent(notes, settings);
      expect(result!.text).toBe(" #new");
    });
  });

  describe("clipboard URL", () => {
    it("detects a URL and suggests #read with hostname label", () => {
      const notes: Note[] = [];
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        lastTagEnabled: false,
      };
      const result = inferIntent(notes, settings, "check out https://example.com/article");
      expect(result).not.toBeNull();
      expect(result!.source).toBe("clipboard-url");
      expect(result!.text).toBe(" https://example.com/article #read");
      expect(result!.label).toBe("read example.com");
    });

    it("handles URLs without www prefix", () => {
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        lastTagEnabled: false,
      };
      const result = inferIntent([], settings, "https://github.com/issues");
      expect(result!.label).toBe("read github.com");
    });

    it("returns null when clipboard has no URL", () => {
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        lastTagEnabled: false,
      };
      const result = inferIntent([], settings, "just plain text");
      expect(result).toBeNull();
    });

    it("returns null when clipboard is empty", () => {
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        lastTagEnabled: false,
      };
      const result = inferIntent([], settings, "");
      expect(result).toBeNull();
    });

    it("returns null when clipboardUrlEnabled is false", () => {
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        timeOfDayEnabled: false,
        lastTagEnabled: false,
        clipboardUrlEnabled: false,
      };
      const result = inferIntent([], settings, "https://example.com");
      expect(result).toBeNull();
    });
  });

  describe("priority ordering", () => {
    it("prefers clipboard URL over time-of-day", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T19:00:00"));
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        lastTagEnabled: false,
      };
      const result = inferIntent([], settings, "https://news.ycombinator.com");
      expect(result!.source).toBe("clipboard-url");
      vi.useRealTimers();
    });

    it("prefers last-tag over time-of-day when clipboard is empty", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T19:00:00"));
      const notes: Note[] = [makeNote("task #work", 1000, ["work"])];
      const settings: IntentSettings = {
        ...getDefaultIntentSettings(),
        clipboardUrlEnabled: false,
      };
      const result = inferIntent(notes, settings);
      expect(result!.source).toBe("last-tag");
      vi.useRealTimers();
    });
  });

  describe("disabled globally", () => {
    it("returns null when all inference types are disabled", () => {
      const settings: IntentSettings = {
        timeOfDayEnabled: false,
        lastTagEnabled: false,
        clipboardUrlEnabled: false,
        calendarEnabled: false,
      };
      const result = inferIntent([makeNote("task #work", 1000, ["work"])], settings, "https://example.com");
      expect(result).toBeNull();
    });
  });

  describe("readClipboard", () => {
    it("returns empty string when navigator.clipboard is unavailable", async () => {
      const original = navigator.clipboard;
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      const result = await readClipboard();
      expect(result).toBe("");
      Object.defineProperty(navigator, "clipboard", { value: original, configurable: true });
    });

    it("returns clipboard text when available", async () => {
      const mockReadText = vi.fn().mockResolvedValue("clipboard content");
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: mockReadText },
        configurable: true,
      });
      const result = await readClipboard();
      expect(result).toBe("clipboard content");
    });

    it("returns empty string on read failure", async () => {
      const mockReadText = vi.fn().mockRejectedValue(new Error("denied"));
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: mockReadText },
        configurable: true,
      });
      const result = await readClipboard();
      expect(result).toBe("");
    });
  });
});
