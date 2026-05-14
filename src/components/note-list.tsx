import DeleteIcon from "@/components/icons/DeleteIcon";
import NoteText from "@/components/note-text";

type Note = {
  id: string;
  text: string;
};

interface Props {
  notes: Note[];
  focusedIndex: number | null;
  noteRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onKeyDown: (e: React.KeyboardEvent, i: number) => void;
  onDelete: (i: number) => void;
}

export default function NoteList({
  notes,
  focusedIndex,
  noteRefs,
  onKeyDown,
  onDelete,
}: Props) {
  if (notes.length === 0) return null;

  return (
    <div className="border-t border-white/10 px-5 py-2 max-h-64 overflow-y-auto">
      {notes.map((note, i) => (
        <div
          key={note.id}
          ref={(el) => {
            noteRefs.current[i] = el;
          }}
          tabIndex={-1}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={`flex items-center gap-3 py-2 rounded-lg px-2 -mx-2 outline-none transition-colors group ${
            focusedIndex === i ? "bg-white/8" : ""
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
              focusedIndex === i ? "bg-white/60" : "bg-white/25"
            }`}
          />
          <span className="flex-1 text-white/80 text-sm leading-snug break-words">
            <NoteText text={note.text} />
          </span>
          <button
            onClick={() => onDelete(i)}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-all"
          >
            <DeleteIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
