import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { store } from "@/lib/store/store";
import type { Note } from "@/types/note";
import {
  inferIntent,
  readClipboard,
  getDefaultIntentSettings,
  type IntentSettings,
  type IntentSuggestion,
} from "@/lib/intent";
import { INTENT_SETTINGS_KEY } from "@/lib/store/config";

const APP_WINDOW = getCurrentWindow();

export function useIntent(notes: Note[], text: string) {
  const [intentSuggestion, setIntentSuggestion] = useState<IntentSuggestion | null>(
    null,
  );
  const [intentSettings, setIntentSettingsState] = useState<IntentSettings>(
    getDefaultIntentSettings,
  );
  const settingsRef = useRef(intentSettings);
  settingsRef.current = intentSettings;

  // Load intent settings on mount.
  useEffect(() => {
    store
      .get<IntentSettings>(INTENT_SETTINGS_KEY)
      .then((saved) => {
        if (saved) {
          setIntentSettingsState(saved);
          settingsRef.current = saved;
        }
      })
      .catch(console.error);
  }, []);

  // Infer intent on window focus when input is empty.
  useEffect(() => {
    const unlisten = APP_WINDOW.onFocusChanged(({ payload: focused }) => {
      if (focused && !text && notes.length > 0) {
        readClipboard().then((clipboard) => {
          const suggestion = inferIntent(notes, settingsRef.current, clipboard);
          if (suggestion) setIntentSuggestion(suggestion);
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [notes, text]);

  const dismissIntent = useCallback(() => {
    setIntentSuggestion(null);
  }, []);

  const acceptIntent = useCallback(() => {
    if (intentSuggestion) {
      const next = intentSuggestion.text.trimStart();
      setIntentSuggestion(null);
      return next;
    }
    return null;
  }, [intentSuggestion]);

  const setIntentSettings = useCallback(
    async (settings: IntentSettings) => {
      setIntentSettingsState(settings);
      settingsRef.current = settings;
      await store.set(INTENT_SETTINGS_KEY, settings);
    },
    [],
  );

  const handleTextChange = useCallback(
    (value: string) => {
      if (intentSuggestion) {
        const suggestedFull = intentSuggestion.text.trim();
        if (
          suggestedFull &&
          value.trim() !== suggestedFull &&
          !value.includes(suggestedFull)
        ) {
          setIntentSuggestion(null);
        }
      }
      return value;
    },
    [intentSuggestion],
  );

  return {
    intentSuggestion,
    intentSettings,
    setIntentSettings,
    dismissIntent,
    acceptIntent,
    handleTextChange,
  };
}
