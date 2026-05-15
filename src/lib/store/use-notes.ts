import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { store } from "@/lib/store/store";
import { Note } from "@/types/note";
import { STORAGE_KEY, SETTINGS_KEY, DEFAULT_TTL_HOURS } from "@/lib/store/config";
import { registerNotification } from "../notification";
import { extractTags, extractTimeTokens } from "@/lib/grammar";
import {
  INSERT_TAG_KEY,
  NEXT_TAG_GROUP_KEY,
  PREV_TAG_GROUP_KEY,
} from "@/lib/shortcut/constants";

const APP_WINDOW = getCurrentWindow();

const COOLDOWN_MS = 30000;
const BUFFER_TTL_MS = 2 * 60 * 60 * 1000;

interface Settings {
  ttlHours: number;
}

function getDefaultSettings(): Settings {
  return { ttlHours: DEFAULT_TTL_HOURS };
}

function hasDelay(text: string): boolean {
  return extractTimeTokens(text).length > 0;
}

function migrateNote(n: Note, index: number = 0, total: number = 1): Note {
  return {
    ...n,
    createdAt: n.createdAt ?? Date.now() - (total - index) * 1000,
    pinned: n.pinned ?? false,
    tags: n.tags ?? (extractTags(n.text).length > 0 ? extractTags(n.text) : undefined),
  };
}

function formatTimeRemaining(ms: number): string {
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

export function useNotes() {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState<Settings>(getDefaultSettings);
  const textRef = useRef(text);
  const notesRef = useRef<Note[]>(notes);
  const settingsRef = useRef<Settings>(settings);
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned === b.pinned) return b.createdAt - a.createdAt;
      return a.pinned ? -1 : 1;
    });
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const query = text.trim().toLowerCase();
    if (!query) return sortedNotes;
    if (query.startsWith("#")) {
      const tagQuery = query.slice(1);
      return sortedNotes.filter((n) =>
        n.tags?.some((t) => t.toLowerCase().includes(tagQuery)),
      );
    }
    return sortedNotes.filter((n) => n.text.toLowerCase().includes(query));
  }, [text, sortedNotes]);

  const tagGroups = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    const untagged: Note[] = [];
    for (const note of sortedNotes) {
      if (note.tags && note.tags.length > 0) {
        for (const tag of note.tags) {
          if (!groups[tag]) groups[tag] = [];
          groups[tag].push(note);
        }
      } else {
        untagged.push(note);
      }
    }
    return groups;
  }, [sortedNotes]);

  const tagGroupBoundaries = useMemo(() => {
    if (text.trim()) return [];
    const sortedTags = Object.keys(tagGroups).sort((a, b) =>
      a.localeCompare(b),
    );
    const boundaries: number[] = [];
    let idx = 0;
    const seen = new Set<string>();
    for (const tag of sortedTags) {
      const group = tagGroups[tag];
      if (!group || group.length === 0) continue;
      boundaries.push(idx);
      for (const note of group) {
        if (!seen.has(note.id)) {
          seen.add(note.id);
          idx++;
        }
      }
    }
    const remaining = sortedNotes.filter((n) => !seen.has(n.id));
    if (remaining.length > 0) {
      boundaries.push(idx);
    }
    return boundaries;
  }, [text, tagGroups, sortedNotes]);

  const expireBuffers = useCallback(async (list?: Note[]) => {
    const current = list ?? notesRef.current;
    const time = Date.now();
    const cleaned = current.filter(
      (n) => !(n.buffer && n.createdAt && time - n.createdAt > BUFFER_TTL_MS),
    );
    if (cleaned.length < current.length) {
      await persistNotes(cleaned);
    }
  }, []);

  const ttlMs = settings.ttlHours * 60 * 60 * 1000;

  const cleanupExpiredNotes = useCallback(() => {
    const time = Date.now();
    const cutoff = time - ttlMs;
    const expired = notesRef.current.filter((n) => !n.pinned && n.createdAt < cutoff);
    if (expired.length > 0) {
      const updated = notesRef.current.filter((n) => n.pinned || n.createdAt >= cutoff);
      persistNotes(updated);
    }
  }, [ttlMs]);

  useEffect(() => {
    store
      .get<Note[]>(STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          const migrated = saved.map((n, i) => migrateNote(n, i, saved.length));
          setNotes(migrated);
          notesRef.current = migrated;
          expireBuffers(migrated);
        }
      })
      .catch(console.error);
    store
      .get<Settings>(SETTINGS_KEY)
      .then((saved) => {
        if (saved) {
          setSettings(saved);
          settingsRef.current = saved;
        }
      })
      .catch(console.error);
  }, [expireBuffers]);

  useEffect(() => {
    cleanupExpiredNotes();
    const interval = setInterval(cleanupExpiredNotes, 60_000);
    return () => clearInterval(interval);
  }, [cleanupExpiredNotes]);

  useEffect(() => {
    if (focusedIndex !== null) {
      noteRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  useEffect(() => {
    const unlisten = APP_WINDOW.onFocusChanged(({ payload: focused }) => {
      if (focused) inputRef.current?.focus();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const focusInput = () => {
    setFocusedIndex(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.activeElement !== inputRef.current) return;
      e.preventDefault();
      if (textRef.current) {
        setText("");
      } else {
        await APP_WINDOW.hide();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const persistNotes = async (updated: Note[]) => {
    setNotes(updated);
    notesRef.current = updated;
    await store.set(STORAGE_KEY, updated);
    await invoke("refresh_tray").catch(console.error);
  };

  const persistSettings = async (updated: Settings) => {
    setSettings(updated);
    settingsRef.current = updated;
    await store.set(SETTINGS_KEY, updated);
  };

  const saveNote = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tags = extractTags(trimmed);
    const isBuffer = tags.length === 0 && !hasDelay(trimmed);
    const newNote: Note = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: Date.now(),
      pinned: false,
      buffer: isBuffer || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
    if (hasDelay(trimmed)) {
      await registerNotification(trimmed);
    }
    setCooldownUntil(Date.now() + COOLDOWN_MS);
    const updated = [newNote, ...notesRef.current];
    await persistNotes(updated);
    setText("");
    await expireBuffers(updated);
  };

  const deleteNote = async (id: string) => {
    await persistNotes(notesRef.current.filter((n) => n.id !== id));
  };

  const togglePin = async (id: string) => {
    const updated = notesRef.current.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
    await persistNotes(updated);
  };

  const getNoteTtl = useCallback(
    (note: Note): string | null => {
      if (note.pinned) return null;
      const remaining = note.createdAt + ttlMs - Date.now();
      return formatTimeRemaining(remaining);
    },
    [ttlMs],
  );

  const classifyBuffer = async (
    id: string,
    action: "tag" | "remind" | "discard",
  ) => {
    if (action === "discard") {
      await deleteNote(id);
      return;
    }
    const updated = notesRef.current.map((n) => {
      if (n.id !== id) return n;
      if (action === "tag") {
        return { ...n, buffer: false };
      }
      const newText = `${n.text} @15m`;
      return { ...n, text: newText, buffer: false };
    });
    await persistNotes(updated);
    if (action === "remind") {
      const note = updated.find((n) => n.id === id);
      if (note) await registerNotification(note.text);
    }
  };

  const getNotesByTag = useCallback(
    (tag: string): Note[] => {
      const normalized = tag.toLowerCase();
      return notesRef.current.filter((n) =>
        n.tags?.some((t) => t.toLowerCase() === normalized),
      );
    },
    [],
  );

  const getAllTags = useCallback((): string[] => {
    const tagSet = new Set<string>();
    for (const note of notesRef.current) {
      if (note.tags) {
        for (const tag of note.tags) {
          tagSet.add(tag.toLowerCase());
        }
      }
    }
    return [...tagSet].sort();
  }, []);

  const addTag = async (id: string, tag: string) => {
    const normalized = tag.toLowerCase();
    const updated = notesRef.current.map((n) => {
      if (n.id !== id) return n;
      const current = n.tags ?? [];
      if (current.includes(normalized)) return n;
      return { ...n, tags: [...current, normalized] };
    });
    await persistNotes(updated);
  };

  const removeTag = async (id: string, tag: string) => {
    const normalized = tag.toLowerCase();
    const updated = notesRef.current.map((n) => {
      if (n.id !== id) return n;
      const current = n.tags ?? [];
      const next = current.filter((t) => t !== normalized);
      return { ...n, tags: next.length > 0 ? next : undefined };
    });
    await persistNotes(updated);
  };

  const promptsVisible = now > cooldownUntil;

  const handleInputKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      await saveNote();
    } else if (e.key === "Tab" && !e.shiftKey && filteredNotes.length > 0) {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (
      (e.metaKey || e.ctrlKey) &&
      e.shiftKey &&
      e.key.toLowerCase() === INSERT_TAG_KEY
    ) {
      e.preventDefault();
      const current = textRef.current;
      if (!current.endsWith(" ") && !current.endsWith("#")) {
        setText(current + " #");
      } else if (current.endsWith(" ")) {
        setText(current + "#");
      }
    }
  };

  const handleNoteKeyDown = async (
    e: React.KeyboardEvent,
    noteId: string,
    i: number,
    total: number,
  ) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
      e.preventDefault();
      await togglePin(noteId);
      return;
    }

    if (
      (e.metaKey || e.ctrlKey) &&
      e.shiftKey &&
      e.key.toLowerCase() === NEXT_TAG_GROUP_KEY
    ) {
      e.preventDefault();
      const next = tagGroupBoundaries.find((b) => b > i);
      if (next !== undefined) setFocusedIndex(next);
      return;
    }

    if (
      (e.metaKey || e.ctrlKey) &&
      e.shiftKey &&
      e.key.toLowerCase() === PREV_TAG_GROUP_KEY
    ) {
      e.preventDefault();
      const prev = [...tagGroupBoundaries].reverse().find((b) => b < i);
      if (prev !== undefined) setFocusedIndex(prev);
      return;
    }

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      i < total - 1 ? setFocusedIndex(i + 1) : focusInput();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      i > 0 ? setFocusedIndex(i - 1) : focusInput();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const updated = notesRef.current.filter((n) => n.id !== noteId);
      const nextFiltered = updated.filter((n) =>
        text.trim()
          ? n.text.toLowerCase().includes(text.trim().toLowerCase())
          : true,
      );
      noteRefs.current = noteRefs.current.slice(0, updated.length);
      await persistNotes(updated);
      nextFiltered.length === 0
        ? focusInput()
        : setFocusedIndex(Math.min(i, nextFiltered.length - 1));
    } else if (e.key === "Escape") {
      focusInput();
    }
  };

  return {
    text,
    setText,
    notes,
    filteredNotes,
    tagGroups,
    tagGroupBoundaries,
    focusedIndex,
    inputRef,
    noteRefs,
    handleInputKeyDown,
    handleNoteKeyDown,
    deleteNote,
    togglePin,
    getNoteTtl,
    classifyBuffer,
    promptsVisible,
    getNotesByTag,
    getAllTags,
    addTag,
    removeTag,
    settings,
    setTtlHours: (hours: number) => persistSettings({ ...settingsRef.current, ttlHours: hours }),
  };
}
