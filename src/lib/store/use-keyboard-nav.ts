import { useRef, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const APP_WINDOW = getCurrentWindow();

interface KeyboardNavDeps {
  focusedIndex: number | null;
  setFocusedIndex: (i: number | null) => void;
}

export function useKeyboardNav({
  focusedIndex,
  setFocusedIndex,
}: KeyboardNavDeps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);

  const focusInput = useCallback(() => {
    setFocusedIndex(null);
    inputRef.current?.focus();
  }, [setFocusedIndex]);

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

  return {
    inputRef,
    noteRefs,
    focusInput,
  };
}
