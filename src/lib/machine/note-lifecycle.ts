import type { Note } from "@/types/note";

export interface Settings {
  ttlHours: number;
}

export function getDefaultSettings(): Settings {
  return { ttlHours: 24 };
}

export type NoteMachineState =
  | { type: "idle" }
  | { type: "capturing" }
  | { type: "parsing"; draft: string }
  | { type: "scheduling"; note: Note }
  | { type: "persisting"; returnTo: NoteMachineState["type"] }
  | { type: "expiring"; returnTo: NoteMachineState["type"] }
  | { type: "exporting"; notes: Note[]; returnTo: NoteMachineState["type"] };

export interface NoteMachineContext {
  notes: Note[];
  text: string;
  focusedIndex: number | null;
  settings: Settings;
  cooldownUntil: number;
}

export type NoteMachineEvent =
  | { type: "TYPE"; text: string }
  | { type: "SUBMIT" }
  | { type: "PARSED"; note: Note }
  | { type: "SCHEDULED" }
  | { type: "PERSISTED"; notes: Note[] }
  | { type: "LOADED"; notes: Note[]; settings?: Settings }
  | { type: "DELETE"; id: string }
  | { type: "TOGGLE_PIN"; id: string }
  | { type: "CLASSIFY_BUFFER"; id: string; action: "tag" | "remind" | "discard" }
  | { type: "ADD_TAG"; id: string; tag: string }
  | { type: "REMOVE_TAG"; id: string; tag: string }
  | { type: "FOCUS"; index: number | null }
  | { type: "CLEAR" }
  | { type: "SET_SETTINGS"; settings: Settings }
  | { type: "EXPIRE"; ids: string[] }
  | { type: "EXPORT"; notes: Note[] }
  | { type: "EXPORT_DONE" }
  | { type: "SET_COOLDOWN"; until: number };

export type Effect =
  | { type: "PARSE_NOTE"; text: string }
  | { type: "REGISTER_NOTIFICATION"; text: string }
  | { type: "PERSIST_NOTES"; notes: Note[] }
  | { type: "PERSIST_SETTINGS"; settings: Settings }
  | { type: "LOAD_DATA" }
  | { type: "REFRESH_TRAY" }
  | { type: "HIDE_WINDOW" }
  | { type: "FOCUS_INPUT" };

interface TransitionResult {
  state: NoteMachineState;
  context: NoteMachineContext;
  effects: Effect[];
}

function noChange(
  state: NoteMachineState,
  context: NoteMachineContext,
): TransitionResult {
  return { state, context, effects: [] };
}

export const COOLDOWN_MS = 30_000;
export const BUFFER_TTL_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_TTL_HOURS = 24;
export const STORAGE_KEY = "notes";
export const SETTINGS_KEY = "settings";

export function getSortedNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned === b.pinned) return b.createdAt - a.createdAt;
    return a.pinned ? -1 : 1;
  });
}

export function getFilteredNotes(notes: Note[], text: string): Note[] {
  const query = text.trim().toLowerCase();
  if (!query) return getSortedNotes(notes);
  const sorted = getSortedNotes(notes);
  if (query.startsWith("#")) {
    const tagQuery = query.slice(1);
    return sorted.filter((n) =>
      n.tags?.some((t) => t.toLowerCase().includes(tagQuery)),
    );
  }
  return sorted.filter((n) => n.text.toLowerCase().includes(query));
}

function mutateNotes(
  notes: Note[],
  event: Extract<
    NoteMachineEvent,
    { type: "DELETE" | "TOGGLE_PIN" | "CLASSIFY_BUFFER" | "ADD_TAG" | "REMOVE_TAG" }
  >,
): Note[] {
  switch (event.type) {
    case "DELETE":
      return notes.filter((n) => n.id !== event.id);
    case "TOGGLE_PIN":
      return notes.map((n) =>
        n.id === event.id ? { ...n, pinned: !n.pinned } : n,
      );
    case "CLASSIFY_BUFFER": {
      if (event.action === "discard") {
        return notes.filter((n) => n.id !== event.id);
      }
      return notes.map((n) => {
        if (n.id !== event.id) return n;
        if (event.action === "tag") {
          return { ...n, buffer: false };
        }
        return { ...n, text: `${n.text} @15m`, buffer: false };
      });
    }
    case "ADD_TAG": {
      const normalized = event.tag.toLowerCase();
      return notes.map((n) => {
        if (n.id !== event.id) return n;
        const current = n.tags ?? [];
        if (current.includes(normalized)) return n;
        return { ...n, tags: [...current, normalized] };
      });
    }
    case "REMOVE_TAG": {
      const normalized = event.tag.toLowerCase();
      return notes.map((n) => {
        if (n.id !== event.id) return n;
        const current = n.tags ?? [];
        const next = current.filter((t) => t !== normalized);
        return { ...n, tags: next.length > 0 ? next : undefined };
      });
    }
  }
}

function persistTransition(
  returnTo: NoteMachineState["type"],
  context: NoteMachineContext,
  nextNotes: Note[],
  nextFocusedIndex?: number | null,
): TransitionResult {
  return {
    state: { type: "persisting", returnTo },
    context: {
      ...context,
      notes: nextNotes,
      focusedIndex:
        nextFocusedIndex !== undefined ? nextFocusedIndex : context.focusedIndex,
    },
    effects: [{ type: "PERSIST_NOTES", notes: nextNotes }],
  };
}

export function createInitialContext(): NoteMachineContext {
  return {
    notes: [],
    text: "",
    focusedIndex: null,
    settings: getDefaultSettings(),
    cooldownUntil: 0,
  };
}

export function transition(
  state: NoteMachineState,
  context: NoteMachineContext,
  event: NoteMachineEvent,
): TransitionResult {
  const isMutation = (
    e: NoteMachineEvent,
  ): e is Extract<
    NoteMachineEvent,
    { type: "DELETE" | "TOGGLE_PIN" | "CLASSIFY_BUFFER" | "ADD_TAG" | "REMOVE_TAG" }
  > => ["DELETE", "TOGGLE_PIN", "CLASSIFY_BUFFER", "ADD_TAG", "REMOVE_TAG"].includes(e.type);

  // Mutation events are handled uniformly across all non-transient states.
  if (isMutation(event) && state.type !== "parsing" && state.type !== "scheduling") {
    const nextNotes = mutateNotes(context.notes, event);
    return persistTransition(state.type, context, nextNotes);
  }

  switch (state.type) {
    case "idle": {
      switch (event.type) {
        case "TYPE":
          return {
            state: { type: "capturing" },
            context: { ...context, text: event.text },
            effects: [],
          };
        case "SUBMIT": {
          const trimmed = context.text.trim();
          if (!trimmed) return noChange(state, context);
          return {
            state: { type: "parsing", draft: trimmed },
            context,
            effects: [{ type: "PARSE_NOTE", text: trimmed }],
          };
        }
        case "FOCUS":
          return {
            state,
            context: { ...context, focusedIndex: event.index },
            effects: [],
          };
        case "SET_SETTINGS":
          return {
            state,
            context: { ...context, settings: event.settings },
            effects: [{ type: "PERSIST_SETTINGS", settings: event.settings }],
          };
        case "LOADED": {
          const nextContext: NoteMachineContext = {
            ...context,
            notes: event.notes,
          };
          if (event.settings) {
            nextContext.settings = event.settings;
          }
          return { state, context: nextContext, effects: [] };
        }
        case "EXPIRE": {
          const nextNotes = context.notes.filter((n) => !event.ids.includes(n.id));
          if (nextNotes.length === context.notes.length) {
            return noChange(state, context);
          }
          return persistTransition("idle", context, nextNotes);
        }
        case "EXPORT":
          return {
            state: { type: "exporting", notes: event.notes, returnTo: "idle" },
            context,
            effects: [],
          };
        default:
          return noChange(state, context);
      }
    }

    case "capturing": {
      switch (event.type) {
        case "TYPE":
          return {
            state,
            context: { ...context, text: event.text },
            effects: [],
          };
        case "SUBMIT": {
          const trimmed = context.text.trim();
          if (!trimmed) return noChange(state, context);
          return {
            state: { type: "parsing", draft: trimmed },
            context,
            effects: [{ type: "PARSE_NOTE", text: trimmed }],
          };
        }
        case "CLEAR":
          return {
            state: { type: "idle" },
            context: { ...context, text: "" },
            effects: [],
          };
        case "FOCUS":
          return {
            state,
            context: { ...context, focusedIndex: event.index },
            effects: [],
          };
        case "SET_COOLDOWN":
          return {
            state,
            context: { ...context, cooldownUntil: event.until },
            effects: [],
          };
        case "LOADED": {
          const nextContext: NoteMachineContext = {
            ...context,
            notes: event.notes,
          };
          if (event.settings) {
            nextContext.settings = event.settings;
          }
          return { state, context: nextContext, effects: [] };
        }
        default:
          return noChange(state, context);
      }
    }

    case "parsing": {
      switch (event.type) {
        case "PARSED": {
          const hasDelay = /@\d+[smhd]/gi.test(event.note.text);
          if (hasDelay) {
            return {
              state: { type: "scheduling", note: event.note },
              context,
              effects: [{ type: "REGISTER_NOTIFICATION", text: event.note.text }],
            };
          }
          const nextNotes = [event.note, ...context.notes];
          return {
            state: { type: "persisting", returnTo: "idle" },
            context: {
              ...context,
              notes: nextNotes,
              text: "",
              focusedIndex: null,
              cooldownUntil: Date.now() + COOLDOWN_MS,
            },
            effects: [
              { type: "PERSIST_NOTES", notes: nextNotes },
              { type: "REFRESH_TRAY" },
            ],
          };
        }
        default:
          return noChange(state, context);
      }
    }

    case "scheduling": {
      switch (event.type) {
        case "SCHEDULED": {
          const nextNotes = [state.note, ...context.notes];
          return {
            state: { type: "persisting", returnTo: "idle" },
            context: {
              ...context,
              notes: nextNotes,
              text: "",
              focusedIndex: null,
              cooldownUntil: Date.now() + COOLDOWN_MS,
            },
            effects: [
              { type: "PERSIST_NOTES", notes: nextNotes },
              { type: "REFRESH_TRAY" },
            ],
          };
        }
        default:
          return noChange(state, context);
      }
    }

    case "persisting": {
      switch (event.type) {
        case "PERSISTED": {
          if (state.returnTo === "capturing") {
            return {
              state: { type: "capturing" },
              context,
              effects: [],
            };
          }
          return {
            state: { type: "idle" },
            context,
            effects: [],
          };
        }
        default:
          return noChange(state, context);
      }
    }

    case "expiring": {
      switch (event.type) {
        case "PERSISTED": {
          if (state.returnTo === "capturing") {
            return {
              state: { type: "capturing" },
              context,
              effects: [],
            };
          }
          return {
            state: { type: "idle" },
            context,
            effects: [],
          };
        }
        default:
          return noChange(state, context);
      }
    }

    case "exporting": {
      switch (event.type) {
        case "EXPORT_DONE":
          return {
            state: { type: state.returnTo } as NoteMachineState,
            context,
            effects: [],
          };
        default:
          return noChange(state, context);
      }
    }
  }
}
