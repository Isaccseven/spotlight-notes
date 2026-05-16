import { useCallback } from "react";
import { useNoteMachine } from "@/lib/machine/use-note-machine";
import { useTTL } from "@/lib/store/use-ttl";
import { useTagIndex } from "@/lib/store/use-tag-index";
import { useKeyboardNav } from "@/lib/store/use-keyboard-nav";
import { useIntent } from "@/lib/store/use-intent";

export function useNotes() {
  const { machineState, context, filteredNotes, actions } = useNoteMachine();

  const ttl = useTTL(context.notes, context.settings, context.cooldownUntil);

  const tags = useTagIndex(context.notes, context.text);
  const intent = useIntent(context.notes, context.text);

  const setText = useCallback(
    (value: string) => {
      const next = intent.handleTextChange(value);
      actions.setText(next);
    },
    [actions.setText, intent.handleTextChange],
  );

  const keyboard = useKeyboardNav({
    focusedIndex: context.focusedIndex,
    setFocusedIndex: actions.focus,
  });

  const notes = context.notes;
  const settings = context.settings;

  return {
    text: context.text,
    setText,
    notes,
    filteredNotes,
    tagGroups: tags.tagGroups,
    tagGroupBoundaries: tags.tagGroupBoundaries,
    focusedIndex: context.focusedIndex,
    inputRef: keyboard.inputRef,
    noteRefs: keyboard.noteRefs,
    focusInput: keyboard.focusInput,
    submit: actions.submit,
    focus: actions.focus,
    deleteNote: actions.deleteNote,
    togglePin: actions.togglePin,
    getNoteTtl: ttl.getNoteTtl,
    classifyBuffer: actions.classifyBuffer,
    promptsVisible: ttl.promptsVisible,
    getNotesByTag: tags.getNotesByTag,
    getAllTags: tags.getAllTags,
    addTag: actions.addTag,
    removeTag: actions.removeTag,
    settings,
    setTtlHours: actions.setTtlHours,
    intentSuggestion: intent.intentSuggestion,
    intentSettings: intent.intentSettings,
    setIntentSettings: intent.setIntentSettings,
    dismissIntent: intent.dismissIntent,
    acceptIntent: intent.acceptIntent,
    machineState,
  };
}
