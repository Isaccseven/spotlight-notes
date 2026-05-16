import type {
  NoteMachineState,
  NoteMachineContext,
  NoteMachineEvent,
} from "@/lib/machine/note-lifecycle";
import type { Note } from "@/types/note";

export interface PluginAPI {
  getState(): NoteMachineState;
  getContext(): NoteMachineContext;
  dispatch(event: NoteMachineEvent): void;
  subscribe(cb: (state: NoteMachineState, context: NoteMachineContext) => void): () => void;
}

export type PluginMiddleware = (
  event: NoteMachineEvent,
  api: PluginAPI,
  next: () => void,
) => void;

export interface Plugin {
  name: string;
  version?: string;
  install(api: PluginAPI): void | (() => void);
}

export interface NoteActions {
  setText: (text: string) => void;
  submit: () => void;
  clear: () => void;
  focus: (index: number | null) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  classifyBuffer: (id: string, action: "tag" | "remind" | "discard") => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  setSettings: (settings: NoteMachineContext["settings"]) => void;
  setTtlHours: (hours: number) => void;
  exportNotes: (notes: Note[]) => void;
  exportDone: () => void;
}

export interface NoteContext {
  state: NoteMachineState;
  context: NoteMachineContext;
  filteredNotes: Note[];
  actions: NoteActions;
  dispatch: (event: NoteMachineEvent) => void;
}
