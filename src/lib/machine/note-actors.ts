import { invoke } from "@tauri-apps/api/core";
import { store } from "@/lib/store/store";
import { extractTags, parseNoteWithRust } from "@/lib/grammar";
import { registerNotification } from "@/lib/notification";
import type { Note } from "@/types/note";
import type {
  Effect,
  NoteMachineContext,
  NoteMachineEvent,
} from "./note-lifecycle";
import { BUFFER_TTL_MS, STORAGE_KEY, SETTINGS_KEY } from "./note-lifecycle";

export type Dispatch = (event: NoteMachineEvent) => void;

export async function parseNote(text: string): Promise<Note> {
  const parsed = await parseNoteWithRust(text);
  const isBuffer = parsed.tags.length === 0 && parsed.delays_ms.length === 0;
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    pinned: false,
    buffer: isBuffer || undefined,
    tags: parsed.tags.length > 0 ? parsed.tags : undefined,
  };
}

export function migrateNote(
  n: Note,
  index: number = 0,
  total: number = 1,
): Note {
  return {
    ...n,
    createdAt: n.createdAt ?? Date.now() - (total - index) * 1000,
    pinned: n.pinned ?? false,
    tags:
      n.tags ??
      (extractTags(n.text).length > 0 ? extractTags(n.text) : undefined),
  };
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
}

export function getNoteTtl(note: Note, ttlMs: number): string | null {
  if (note.pinned) return null;
  const remaining = note.createdAt + ttlMs - Date.now();
  return formatTimeRemaining(remaining);
}

export function expireBuffers(notes: Note[]): Note[] {
  const now = Date.now();
  return notes.filter(
    (n) => !(n.buffer && n.createdAt && now - n.createdAt > BUFFER_TTL_MS),
  );
}

export function cleanupExpiredNotes(notes: Note[], ttlMs: number): Note[] {
  const cutoff = Date.now() - ttlMs;
  return notes.filter((n) => n.pinned || n.createdAt >= cutoff);
}

export async function executeEffect(
  effect: Effect,
  dispatch: Dispatch,
): Promise<void> {
  switch (effect.type) {
    case "PARSE_NOTE": {
      const note = await parseNote(effect.text);
      dispatch({ type: "PARSED", note });
      break;
    }
    case "REGISTER_NOTIFICATION": {
      await registerNotification(effect.text);
      dispatch({ type: "SCHEDULED" });
      break;
    }
    case "PERSIST_NOTES": {
      await store.set(STORAGE_KEY, effect.notes);
      await invoke("refresh_tray").catch(console.error);
      dispatch({ type: "PERSISTED", notes: effect.notes });
      break;
    }
    case "PERSIST_SETTINGS": {
      await store.set(SETTINGS_KEY, effect.settings);
      break;
    }
    case "LOAD_DATA": {
      const savedNotes = await store.get<Note[]>(STORAGE_KEY);
      const savedSettings = await store.get<{ ttlHours: number }>(SETTINGS_KEY);
      const notes = savedNotes
        ? savedNotes.map((n, i) => migrateNote(n, i, savedNotes.length))
        : [];
      const settings = savedSettings
        ? { ttlHours: savedSettings.ttlHours ?? 24 }
        : undefined;
      dispatch({ type: "LOADED", notes, settings });
      const now = Date.now();
      const expiredBufferIds = notes
        .filter((n) => n.buffer && n.createdAt && now - n.createdAt > BUFFER_TTL_MS)
        .map((n) => n.id);
      if (expiredBufferIds.length > 0) {
        dispatch({ type: "EXPIRE", ids: expiredBufferIds });
      }
      break;
    }
    case "REFRESH_TRAY":
      await invoke("refresh_tray").catch(console.error);
      break;
    case "HIDE_WINDOW":
      {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().hide();
      }
      break;
    case "FOCUS_INPUT":
      break;
  }
}

export async function runAutoExpire(
  context: NoteMachineContext,
  dispatch: Dispatch,
): Promise<void> {
  const ttlMs = context.settings.ttlHours * 60 * 60 * 1000;
  const cleaned = cleanupExpiredNotes(context.notes, ttlMs);
  const expiredIds = context.notes
    .filter((n) => !cleaned.some((c) => c.id === n.id))
    .map((n) => n.id);
  if (expiredIds.length > 0) {
    dispatch({ type: "EXPIRE", ids: expiredIds });
  }
}

export function getTagGroups(notes: Note[]): Record<string, Note[]> {
  const groups: Record<string, Note[]> = {};
  for (const note of notes) {
    if (note.tags && note.tags.length > 0) {
      for (const tag of note.tags) {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(note);
      }
    }
  }
  return groups;
}

export function getTagGroupBoundaries(
  notes: Note[],
  text: string,
): number[] {
  if (text.trim()) return [];
  const groups = getTagGroups(notes);
  const sortedTags = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  const boundaries: number[] = [];
  let idx = 0;
  const seen = new Set<string>();
  for (const tag of sortedTags) {
    const group = groups[tag];
    if (!group || group.length === 0) continue;
    boundaries.push(idx);
    for (const note of group) {
      if (!seen.has(note.id)) {
        seen.add(note.id);
        idx++;
      }
    }
  }
  const remaining = notes.filter((n) => !seen.has(n.id));
  if (remaining.length > 0) {
    boundaries.push(idx);
  }
  return boundaries;
}

export function getAllTags(notes: Note[]): string[] {
  const tagSet = new Set<string>();
  for (const note of notes) {
    if (note.tags) {
      for (const tag of note.tags) {
        tagSet.add(tag.toLowerCase());
      }
    }
  }
  return [...tagSet].sort();
}

export function getNotesByTag(notes: Note[], tag: string): Note[] {
  const normalized = tag.toLowerCase();
  return notes.filter((n) =>
    n.tags?.some((t) => t.toLowerCase() === normalized),
  );
}

export function addTag(notes: Note[], id: string, tag: string): Note[] {
  const normalized = tag.toLowerCase();
  return notes.map((n) => {
    if (n.id !== id) return n;
    const current = n.tags ?? [];
    if (current.includes(normalized)) return n;
    return { ...n, tags: [...current, normalized] };
  });
}

export function removeTag(notes: Note[], id: string, tag: string): Note[] {
  const normalized = tag.toLowerCase();
  return notes.map((n) => {
    if (n.id !== id) return n;
    const current = n.tags ?? [];
    const next = current.filter((t) => t !== normalized);
    return { ...n, tags: next.length > 0 ? next : undefined };
  });
}
