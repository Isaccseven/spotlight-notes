import SearchIcon from "@/components/icons/SearchIcon";
import CloseIcon from "@/components/icons/CloseIcon";
import NoteText from "@/components/note-text";

interface Props {
  text: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClear: () => void;
}

export default function NoteInput({ text, inputRef, onChange, onKeyDown, onClear }: Props) {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      <SearchIcon />

      <div className="relative flex-1">
        {/* Mirror div renders highlighted text behind the transparent input */}
        <div
          aria-hidden="true"
          className="absolute inset-0 text-[20px] leading-none pointer-events-none whitespace-pre overflow-hidden flex items-center"
        >
          {text ? <NoteText text={text} /> : null}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a quick note..."
          className="relative w-full bg-transparent placeholder-white/40 text-[20px] outline-none caret-white"
          style={{ color: "transparent" }}
          autoFocus
        />
      </div>

      {text && (
        <button
          onClick={onClear}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

