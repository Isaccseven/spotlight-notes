import { useEffect } from "react";
import { registerMiddleware } from "@/lib/plugin/middleware";
import type { PluginMiddleware } from "@/lib/plugin/types";
import { runMatchedActions } from "./registry";

const routerMiddleware: PluginMiddleware = (event, _api, next) => {
  if (event.type === "PARSED") {
    // Run matched actions asynchronously without blocking the transition.
    runMatchedActions(event.note).catch(console.error);
  }
  next();
};

export function useAutoRouter() {
  useEffect(() => {
    return registerMiddleware(routerMiddleware);
  }, []);
}
