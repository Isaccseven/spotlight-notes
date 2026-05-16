import { useState, useMemo, useCallback } from "react";
import type { Note } from "@/types/note";
import {
  getSortedNotes,
  getFilteredNotes,
  type Settings,
  getDefaultSettings,
} from "@/lib/machine/note-lifecycle";

export function useNoteState() {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(getDefaultSettings);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const sortedNotes = useMemo(() => getSortedNotes(notes), [notes]);
  const filteredNotes = useMemo(
    () => getFilteredNotes(notes, text),
    [notes, text],
  );

  const deleteNote = useCallback(
    (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id)),
    [],
  );

  const togglePin = useCallback(
    (id: string) =>
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
      ),
    [],
  );

  const setNotesAndCooldown = useCallback((nextNotes: Note[]) => {
    setNotes(nextNotes);
    setCooldownUntil(Date.now() + 30_000);
  }, []);

  return {
    text,
    setText,
    notes,
    setNotes,
    sortedNotes,
    filteredNotes,
    focusedIndex,
    setFocusedIndex,
    settings,
    setSettings,
    cooldownUntil,
    setCooldownUntil,
    deleteNote,
    togglePin,
    setNotesAndCooldown,
  };
}
