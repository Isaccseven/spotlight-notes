import { createContext, useContext, useRef, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useNoteMachine } from "@/lib/machine/use-note-machine";
import type { NoteMachineState, NoteMachineContext, NoteMachineEvent } from "@/lib/machine/note-lifecycle";
import type { Plugin, PluginAPI } from "./types";
import { registerPlugin } from "./registry";
import { runMiddleware } from "./middleware";

export const PluginContext = createContext<PluginAPI | null>(null);

export function usePluginContext(): PluginAPI {
  const ctx = useContext(PluginContext);
  if (!ctx) throw new Error("usePluginContext must be used within a PluginProvider");
  return ctx;
}

interface Props {
  children: ReactNode;
  plugins?: Plugin[];
}

export function PluginProvider({ children, plugins = [] }: Props) {
  const { machineState, context, dispatch: rawDispatch } = useNoteMachine();

  const stateRef = useRef(machineState);
  const contextRef = useRef(context);
  const rawDispatchRef = useRef(rawDispatch);
  stateRef.current = machineState;
  contextRef.current = context;
  rawDispatchRef.current = rawDispatch;

  const subsRef = useRef<Set<(state: NoteMachineState, context: NoteMachineContext) => void>>(new Set());

  useEffect(() => {
    for (const cb of subsRef.current) {
      cb(machineState, context);
    }
  }, [machineState, context]);

  // Stable wrapper that always reads latest refs
  const api = useMemo<PluginAPI>(() => {
    const wrappedDispatch = (event: NoteMachineEvent) => {
      const apiProxy: PluginAPI = {
        getState: () => stateRef.current,
        getContext: () => contextRef.current,
        dispatch: wrappedDispatch,
        subscribe: (cb) => {
          subsRef.current.add(cb);
          return () => subsRef.current.delete(cb);
        },
      };
      runMiddleware(event, apiProxy, () => rawDispatchRef.current(event));
    };

    return {
      getState: () => stateRef.current,
      getContext: () => contextRef.current,
      dispatch: wrappedDispatch,
      subscribe: (cb) => {
        subsRef.current.add(cb);
        return () => subsRef.current.delete(cb);
      },
    };
  }, []);

  // Register plugins once on mount
  useEffect(() => {
    const uninstallers: (() => void)[] = [];
    for (const plugin of plugins) {
      uninstallers.push(registerPlugin(api, plugin));
    }
    return () => {
      for (const fn of uninstallers) fn();
    };
  }, []);

  return (
    <PluginContext.Provider value={api}>
      {children}
    </PluginContext.Provider>
  );
}
