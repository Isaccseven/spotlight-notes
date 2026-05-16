import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Note } from "@/types/note";
import {
  transition,
  createInitialContext,
  getFilteredNotes,
  BUFFER_TTL_MS,
  type NoteMachineState,
  type NoteMachineContext,
  type NoteMachineEvent,
  type Effect,
} from "./note-lifecycle";
import { executeEffect } from "./note-actors";

export function useNoteMachine() {
  const [machineState, setMachineState] = useState<NoteMachineState>({
    type: "idle",
  });
  const [context, setContext] = useState<NoteMachineContext>(createInitialContext);
  const effectsRef = useRef<Effect[]>([{ type: "LOAD_DATA" }]);

  const machineStateRef = useRef(machineState);
  machineStateRef.current = machineState;
  const contextRef = useRef(context);
  contextRef.current = context;

  const dispatchRef = useRef<(event: NoteMachineEvent) => void>(() => {});
  dispatchRef.current = useCallback((event: NoteMachineEvent) => {
    const result = transition(machineStateRef.current, contextRef.current, event);
    machineStateRef.current = result.state;
    contextRef.current = result.context;
    setMachineState(result.state);
    setContext(result.context);
    if (result.effects.length > 0) {
      effectsRef.current.push(...result.effects);
    }
  }, []);

  useEffect(() => {
    const effects = effectsRef.current;
    if (effects.length === 0) return;
    effectsRef.current = [];
    for (const effect of effects) {
      executeEffect(effect, (event) => dispatchRef.current(event)).catch(console.error);
    }
  });

  // Auto-expire old notes and buffers every 60 seconds.
  const notesRef = useRef(context.notes);
  notesRef.current = context.notes;

  useEffect(() => {
    const check = () => {
      const ttlMs = context.settings.ttlHours * 60 * 60 * 1000;
      const now = Date.now();
      const expiredIds = notesRef.current
        .filter((n) => {
          if (n.pinned) return false;
          if (n.buffer && n.createdAt && now - n.createdAt > BUFFER_TTL_MS) return true;
          return n.createdAt < now - ttlMs;
        })
        .map((n) => n.id);
      if (expiredIds.length > 0) {
        dispatchRef.current({ type: "EXPIRE", ids: expiredIds });
      }
    };
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [context.settings]);

  const filteredNotes = useMemo(
    () => getFilteredNotes(context.notes, context.text),
    [context.notes, context.text],
  );

  const actions = useMemo(
    () => ({
      setText: (text: string) => dispatchRef.current({ type: "TYPE", text }),
      submit: () => dispatchRef.current({ type: "SUBMIT" }),
      clear: () => dispatchRef.current({ type: "CLEAR" }),
      focus: (index: number | null) => dispatchRef.current({ type: "FOCUS", index }),
      deleteNote: (id: string) => dispatchRef.current({ type: "DELETE", id }),
      togglePin: (id: string) => dispatchRef.current({ type: "TOGGLE_PIN", id }),
      classifyBuffer: (id: string, action: "tag" | "remind" | "discard") =>
        dispatchRef.current({ type: "CLASSIFY_BUFFER", id, action }),
      addTag: (id: string, tag: string) =>
        dispatchRef.current({ type: "ADD_TAG", id, tag }),
      removeTag: (id: string, tag: string) =>
        dispatchRef.current({ type: "REMOVE_TAG", id, tag }),
      setSettings: (settings: NoteMachineContext["settings"]) =>
        dispatchRef.current({ type: "SET_SETTINGS", settings }),
      setTtlHours: (hours: number) =>
        dispatchRef.current({
          type: "SET_SETTINGS",
          settings: { ...context.settings, ttlHours: hours },
        }),
      exportNotes: (notes: Note[]) => dispatchRef.current({ type: "EXPORT", notes }),
      exportDone: () => dispatchRef.current({ type: "EXPORT_DONE" }),
    }),
    [context.settings],
  );

  return {
    machineState,
    context,
    filteredNotes,
    actions,
    dispatch: dispatchRef.current,
  };
}
