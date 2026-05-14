import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { store } from "@/lib/store/store";
import { Note } from "@/types/note";
import { STORAGE_KEY } from "@/lib/store/config";
import { registerNotification } from "../notification";

const APP_WINDOW = getCurrentWindow();

export function useNotes() {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const textRef = useRef(text);
  const notesRef = useRef<Note[]>(notes);
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    store
      .get<Note[]>(STORAGE_KEY)
      .then((saved) => {
        if (saved) setNotes(saved);
      })
      .catch(console.error);
  }, []);

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
    await store.set(STORAGE_KEY, updated);
  };

  const saveNote = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newNote: Note = { id: crypto.randomUUID(), text: trimmed };
    if (trimmed.includes("@")) {
      await registerNotification(trimmed);
    }
    // Use notesRef to avoid stale closure capture (fix #3)
    await persistNotes([newNote, ...notesRef.current]);
    setText("");
  };

  const deleteNote = async (index: number) => {
    await persistNotes(notes.filter((_, i) => i !== index));
  };

  const handleInputKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      await saveNote();
    } else if (e.key === "Tab" && !e.shiftKey && notes.length > 0) {
      e.preventDefault();
      setFocusedIndex(0);
    }
  };

  const handleNoteKeyDown = async (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      i < notes.length - 1 ? setFocusedIndex(i + 1) : focusInput();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      i > 0 ? setFocusedIndex(i - 1) : focusInput();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const updated = notes.filter((_, idx) => idx !== i);
      // Trim stale refs before updating focus (fix #1)
      noteRefs.current = noteRefs.current.slice(0, updated.length);
      await persistNotes(updated);
      updated.length === 0
        ? focusInput()
        : setFocusedIndex(Math.min(i, updated.length - 1));
    } else if (e.key === "Escape") {
      focusInput();
    }
  };

  return {
    text,
    setText,
    notes,
    focusedIndex,
    inputRef,
    noteRefs,
    handleInputKeyDown,
    handleNoteKeyDown,
    deleteNote,
  };
}
