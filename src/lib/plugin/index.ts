export { PluginProvider, usePluginContext } from "./context";
export { useNoteContext, useNoteActions, useNoteDispatch, useNoteState } from "./hooks";
export { registerMiddleware, clearMiddlewares } from "./middleware";
export { registerPlugin, getRegisteredPlugins, unregisterAllPlugins } from "./registry";
export type {
  Plugin,
  PluginAPI,
  PluginMiddleware,
  NoteActions,
  NoteContext,
} from "./types";
