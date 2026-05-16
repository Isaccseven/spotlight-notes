import { useContext, useMemo, useCallback, useState, useEffect } from "react";
import { PluginContext } from "./context";
import { getFilteredNotes } from "@/lib/machine/note-lifecycle";
import type { NoteActions, NoteContext } from "./types";

export function useNoteContext(): NoteContext {
  const api = useContext(PluginContext);
  if (!api) throw new Error("useNoteContext must be used within a PluginProvider");

  const [state, setState] = useState(api.getState);
  const context = api.getContext();

  useEffect(() => {
    return api.subscribe((nextState) => {
      setState(nextState);
    });
  }, [api]);

  const actions: NoteActions = useMemo(
    () => ({
      setText: (text: string) => api.dispatch({ type: "TYPE", text }),
      submit: () => api.dispatch({ type: "SUBMIT" }),
      clear: () => api.dispatch({ type: "CLEAR" }),
      focus: (index: number | null) => api.dispatch({ type: "FOCUS", index }),
      deleteNote: (id: string) => api.dispatch({ type: "DELETE", id }),
      togglePin: (id: string) => api.dispatch({ type: "TOGGLE_PIN", id }),
      classifyBuffer: (id: string, action: "tag" | "remind" | "discard") =>
        api.dispatch({ type: "CLASSIFY_BUFFER", id, action }),
      addTag: (id: string, tag: string) => api.dispatch({ type: "ADD_TAG", id, tag }),
      removeTag: (id: string, tag: string) => api.dispatch({ type: "REMOVE_TAG", id, tag }),
      setSettings: (settings) => api.dispatch({ type: "SET_SETTINGS", settings }),
      setTtlHours: (hours: number) =>
        api.dispatch({
          type: "SET_SETTINGS",
          settings: { ...context.settings, ttlHours: hours },
        }),
      exportNotes: (notes) => api.dispatch({ type: "EXPORT", notes }),
      exportDone: () => api.dispatch({ type: "EXPORT_DONE" }),
    }),
    [api, context.settings],
  );

  const filteredNotes = useMemo(
    () => getFilteredNotes(context.notes, context.text),
    [context.notes, context.text],
  );

  return {
    state,
    context,
    filteredNotes,
    actions,
    dispatch: api.dispatch,
  };
}

export function useNoteActions(): NoteActions {
  const { actions } = useNoteContext();
  return actions;
}

export function useNoteDispatch() {
  const api = useContext(PluginContext);
  if (!api) throw new Error("useNoteDispatch must be used within a PluginProvider");
  return useCallback(
    (event: Parameters<typeof api.dispatch>[0]) => api.dispatch(event),
    [api],
  );
}

export function useNoteState() {
  const api = useContext(PluginContext);
  if (!api) throw new Error("useNoteState must be used within a PluginProvider");
  const [state, setState] = useState(api.getState);
  useEffect(() => {
    return api.subscribe((nextState) => {
      setState(nextState);
    });
  }, [api]);
  return state;
}
