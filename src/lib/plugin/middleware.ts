import type { NoteMachineEvent } from "@/lib/machine/note-lifecycle";
import type { PluginMiddleware } from "./types";

const middlewares: PluginMiddleware[] = [];

export function registerMiddleware(mw: PluginMiddleware): () => void {
  middlewares.push(mw);
  return () => {
    const idx = middlewares.indexOf(mw);
    if (idx !== -1) middlewares.splice(idx, 1);
  };
}

export function runMiddleware(
  event: NoteMachineEvent,
  api: Parameters<PluginMiddleware>[1],
  final: () => void,
): void {
  let index = 0;

  function next() {
    const mw = middlewares[index++];
    if (mw) {
      mw(event, api, next);
    } else {
      final();
    }
  }

  next();
}

export function clearMiddlewares(): void {
  middlewares.length = 0;
}
