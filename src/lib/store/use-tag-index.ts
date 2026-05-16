import { useMemo, useCallback } from "react";
import type { Note } from "@/types/note";
import {
  getTagGroups,
  getTagGroupBoundaries,
  getAllTags,
  getNotesByTag,
  addTag,
  removeTag,
} from "@/lib/machine/note-actors";

export function useTagIndex(notes: Note[], text: string) {
  const tagGroups = useMemo(() => getTagGroups(notes), [notes]);

  const tagGroupBoundaries = useMemo(
    () => getTagGroupBoundaries(notes, text),
    [notes, text],
  );

  const getNotesByTagFn = useCallback(
    (tag: string) => getNotesByTag(notes, tag),
    [notes],
  );

  const getAllTagsFn = useCallback(() => getAllTags(notes), [notes]);

  const addTagFn = useCallback(
    (id: string, tag: string) => addTag(notes, id, tag),
    [notes],
  );

  const removeTagFn = useCallback(
    (id: string, tag: string) => removeTag(notes, id, tag),
    [notes],
  );

  return {
    tagGroups,
    tagGroupBoundaries,
    getNotesByTag: getNotesByTagFn,
    getAllTags: getAllTagsFn,
    addTag: addTagFn,
    removeTag: removeTagFn,
  };
}
