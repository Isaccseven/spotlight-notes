import { extractTags } from "./grammar";
import type { Note } from "@/types/note";

export interface IntentSettings {
  timeOfDayEnabled: boolean;
  lastTagEnabled: boolean;
  clipboardUrlEnabled: boolean;
  calendarEnabled: boolean;
}

export function getDefaultIntentSettings(): IntentSettings {
  return {
    timeOfDayEnabled: true,
    lastTagEnabled: true,
    clipboardUrlEnabled: true,
    calendarEnabled: false,
  };
}

export interface IntentSuggestion {
  text: string;
  source: "time-of-day" | "last-tag" | "clipboard-url" | "calendar";
  label?: string;
}

const URL_PATTERN = /https?:\/\/[^\s]+/i;

function getTimeOfDaySuggestion(): IntentSuggestion | null {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) {
    return { text: "", source: "time-of-day", label: "morning log" };
  }
  if (hour >= 17 && hour < 22) {
    return { text: " @8h", source: "time-of-day", label: "evening reminder" };
  }
  return null;
}

function getLastTagSuggestion(notes: Note[]): IntentSuggestion | null {
  if (notes.length === 0) return null;
  const latest = [...notes].sort((a, b) => b.createdAt - a.createdAt)[0];
  const tags = latest.tags ?? extractTags(latest.text);
  if (tags.length === 0) return null;
  const lastTag = tags[tags.length - 1];
  return { text: ` #${lastTag}`, source: "last-tag", label: `continue #${lastTag}` };
}

function getClipboardUrlSuggestion(clipboardText: string): IntentSuggestion | null {
  if (!clipboardText) return null;
  const match = URL_PATTERN.exec(clipboardText);
  if (!match) return null;
  const url = match[0];
  try {
    const parsed = new URL(url);
    const title = parsed.hostname.replace(/^www\./, "");
    return { text: ` ${url} #read`, source: "clipboard-url", label: `read ${title}` };
  } catch {
    return { text: ` ${url} #read`, source: "clipboard-url", label: "read link" };
  }
}

function getCalendarSuggestion(): IntentSuggestion | null {
  return null;
}

export function inferIntent(
  notes: Note[],
  settings: IntentSettings,
  clipboardText?: string,
): IntentSuggestion | null {
  if (!settings.timeOfDayEnabled && !settings.lastTagEnabled && !settings.clipboardUrlEnabled && !settings.calendarEnabled) {
    return null;
  }

  if (settings.clipboardUrlEnabled && clipboardText) {
    const urlSuggestion = getClipboardUrlSuggestion(clipboardText);
    if (urlSuggestion) return urlSuggestion;
  }

  if (settings.calendarEnabled) {
    const calendarSuggestion = getCalendarSuggestion();
    if (calendarSuggestion) return calendarSuggestion;
  }

  if (settings.lastTagEnabled) {
    const tagSuggestion = getLastTagSuggestion(notes);
    if (tagSuggestion) return tagSuggestion;
  }

  if (settings.timeOfDayEnabled) {
    const timeSuggestion = getTimeOfDaySuggestion();
    if (timeSuggestion) return timeSuggestion;
  }

  return null;
}

export async function readClipboard(): Promise<string> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // Clipboard read may be denied; fail silently.
  }
  return "";
}
