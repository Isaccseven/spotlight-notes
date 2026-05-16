import { useMemo } from "react";
import DeleteIcon from "@/components/icons/DeleteIcon";
import PinIcon from "@/components/icons/PinIcon";
import NoteText from "@/components/note-text";
import NoteBadges from "@/components/note-badges";
import { useTheme } from "@/lib/theme/context";
import type { Note } from "@/types/note";

interface Props {
  notes: Note[];
  query?: string;
  focusedIndex: number | null;
  noteRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  getNoteTtl: (note: Note) => string | null;
  classifyBuffer: (id: string, action: "tag" | "remind" | "discard") => void;
  promptsVisible: boolean;
  onTagClick?: (tag: string) => void;
}

export default function NoteList({
  notes,
  query,
  focusedIndex,
  noteRefs,
  onDelete,
  onTogglePin,
  getNoteTtl,
  classifyBuffer,
  promptsVisible,
  onTagClick,
}: Props) {
  const { isDark } = useTheme();

  if (notes.length === 0) return null;

  const trimmedQuery = query ?? "";
  const isTagFilter = trimmedQuery.startsWith("#");
  const isFiltering = trimmedQuery.length > 0;

  const { flatList, groupHeaders, summary } = useMemo(() => {
    const localTagGroups: Record<string, Note[]> = {};
    for (const note of notes) {
      for (const tag of note.tags ?? []) {
        if (!localTagGroups[tag]) localTagGroups[tag] = [];
        localTagGroups[tag].push(note);
      }
    }

    if (isFiltering && !isTagFilter) {
      return {
        flatList: notes,
        groupHeaders: new Map<number, string>(),
        summary: null,
      };
    }

    const headers = new Map<number, string>();
    const list: Note[] = [];
    const seen = new Set<string>();

    const sortedTags = Object.keys(localTagGroups).sort((a, b) =>
      a.localeCompare(b),
    );

    for (const tag of sortedTags) {
      const group = localTagGroups[tag];
      if (!group || group.length === 0) continue;
      headers.set(list.length, `#${tag}`);
      for (const note of group) {
        if (!seen.has(note.id)) {
          seen.add(note.id);
          list.push(note);
        }
      }
    }

    const untagged = notes.filter((n) => !seen.has(n.id));
    if (untagged.length > 0) {
      headers.set(list.length, "Untagged");
      for (const note of untagged) {
        if (!seen.has(note.id)) {
          seen.add(note.id);
          list.push(note);
        }
      }
    }

    const summary = isTagFilter
      ? `${notes.length} note${notes.length !== 1 ? "s" : ""} matching ${trimmedQuery}`
      : null;

    return { flatList: list, groupHeaders: headers, summary };
  }, [isFiltering, isTagFilter, notes, trimmedQuery]);

  return (
    <div
      className={`px-5 py-2 max-h-64 overflow-y-auto ${
        isDark ? "border-t border-white/10" : "border-t border-black/10"
      }`}
    >
      {summary && (
        <div
          className={`pb-1 text-[10px] uppercase tracking-wider font-medium ${
            isDark ? "text-white/40" : "text-black/40"
          }`}
        >
          {summary}
        </div>
      )}
      {flatList.map((note, i) => {
        const ttl = getNoteTtl(note);
        const showPrompt = note.buffer && promptsVisible;

        return (
          <div key={note.id}>
            {groupHeaders.has(i) && (
              <div
                className={`pt-2 pb-1 text-[10px] uppercase tracking-wider font-medium ${
                  isDark ? "text-white/30" : "text-black/30"
                }`}
              >
                {groupHeaders.get(i)}
              </div>
            )}
            <div
              ref={(el) => {
                noteRefs.current[i] = el;
              }}
              data-note-index={i}
              tabIndex={-1}
              className={`flex flex-col gap-1 py-2 rounded-lg px-2 -mx-2 outline-none transition-colors group ${
                focusedIndex === i
                  ? isDark
                    ? "bg-white/8"
                    : "bg-black/8"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                    note.buffer
                      ? "bg-amber-400/70"
                      : focusedIndex === i
                        ? isDark
                          ? "bg-white/60"
                          : "bg-black/60"
                        : isDark
                          ? "bg-white/25"
                          : "bg-black/25"
                  }`}
                />
                <span
                  className={`flex-1 text-sm leading-snug break-words ${
                    isDark ? "text-white/80" : "text-black/80"
                  }`}
                >
                  <NoteText text={note.text} onTagClick={onTagClick} />
                </span>
                <NoteBadges text={note.text} />
                {ttl && (
                  <span
                    className={`text-[10px] flex-shrink-0 ${
                      isDark ? "text-white/30" : "text-black/30"
                    }`}
                  >
                    {ttl}
                  </span>
                )}
                <button
                  onClick={() => onTogglePin(note.id)}
                  className={`flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    note.pinned
                      ? isDark
                        ? "bg-white/25 opacity-100"
                        : "bg-black/25 opacity-100"
                      : isDark
                        ? "bg-white/10 hover:bg-white/25"
                        : "bg-black/10 hover:bg-black/25"
                  }`}
                  title={note.pinned ? "Unpin (Ctrl+P)" : "Pin (Ctrl+P)"}
                >
                  <PinIcon filled={note.pinned} />
                </button>
                <button
                  onClick={() => onDelete(note.id)}
                  className={`flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    isDark
                      ? "bg-white/10 hover:bg-white/25"
                      : "bg-black/10 hover:bg-black/25"
                  }`}
                >
                  <DeleteIcon />
                </button>
              </div>

              {showPrompt && (
                <div className="flex items-center gap-2 pl-3.5">
                  <span className="text-[10px] text-amber-400/60 uppercase tracking-wider">
                    Buffer
                  </span>
                  <button
                    onClick={() => classifyBuffer(note.id, "tag")}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      isDark
                        ? "bg-white/10 hover:bg-white/20 text-white/70"
                        : "bg-black/10 hover:bg-black/20 text-black/70"
                    }`}
                  >
                    Tag
                  </button>
                  <button
                    onClick={() => classifyBuffer(note.id, "remind")}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      isDark
                        ? "bg-white/10 hover:bg-white/20 text-white/70"
                        : "bg-black/10 hover:bg-black/20 text-black/70"
                    }`}
                  >
                    Remind
                  </button>
                  <button
                    onClick={() => classifyBuffer(note.id, "discard")}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      isDark
                        ? "bg-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-300"
                        : "bg-black/10 hover:bg-red-500/20 text-black/50 hover:text-red-600"
                    }`}
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
