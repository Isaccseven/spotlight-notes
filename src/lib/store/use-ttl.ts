import { useState, useEffect, useCallback, useMemo } from "react";
import type { Note } from "@/types/note";
import {
  getNoteTtl as getNoteTtlPure,
} from "@/lib/machine/note-actors";
import { type Settings } from "@/lib/machine/note-lifecycle";

export function useTTL(
  _notes: Note[],
  settings: Settings,
  cooldownUntil: number,
) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const ttlMs = useMemo(
    () => settings.ttlHours * 60 * 60 * 1000,
    [settings.ttlHours],
  );

  const getNoteTtl = useCallback(
    (note: Note) => getNoteTtlPure(note, ttlMs),
    [ttlMs],
  );

  const promptsVisible = now > cooldownUntil;

  return {
    getNoteTtl,
    promptsVisible,
    now,
  };
}
