import { useCallback, useEffect } from "react";
import { store } from "@/lib/store/store";
import { invoke } from "@tauri-apps/api/core";
import type { Note } from "@/types/note";
import {
  type Settings,
  STORAGE_KEY,
  SETTINGS_KEY,
} from "@/lib/machine/note-lifecycle";
import { migrateNote } from "@/lib/machine/note-actors";

interface PersistenceAPI {
  loadNotes: () => Promise<Note[] | null>;
  saveNotes: (notes: Note[]) => Promise<void>;
  loadSettings: () => Promise<Settings | null>;
  saveSettings: (settings: Settings) => Promise<void>;
}

export function usePersistence(
  onNotesLoaded: (notes: Note[]) => void,
  onSettingsLoaded: (settings: Settings) => void,
): PersistenceAPI {
  const loadNotes = useCallback(async () => {
    const saved = await store.get<Note[]>(STORAGE_KEY);
    if (!saved) return null;
    const migrated = saved.map((n, i) => migrateNote(n, i, saved.length));
    onNotesLoaded(migrated);
    return migrated;
  }, [onNotesLoaded]);

  const saveNotes = useCallback(async (notes: Note[]) => {
    await store.set(STORAGE_KEY, notes);
    await invoke("refresh_tray").catch(console.error);
  }, []);

  const loadSettings = useCallback(async () => {
    const saved = await store.get<Settings>(SETTINGS_KEY);
    if (saved) {
      onSettingsLoaded(saved);
      return saved;
    }
    return null;
  }, [onSettingsLoaded]);

  const saveSettings = useCallback(async (settings: Settings) => {
    await store.set(SETTINGS_KEY, settings);
  }, []);

  useEffect(() => {
    loadNotes().catch(console.error);
    loadSettings().catch(console.error);
  }, [loadNotes, loadSettings]);

  return { loadNotes, saveNotes, saveSettings, loadSettings };
}
