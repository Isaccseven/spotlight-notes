import SearchIcon from "@/components/icons/SearchIcon";
import CloseIcon from "@/components/icons/CloseIcon";
import NoteText from "@/components/note-text";
import { useTheme } from "@/lib/theme/context";
import type { IntentSuggestion } from "@/lib/intent";

interface Props {
  text: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  
  onClear: () => void;
  suggestion?: IntentSuggestion | null;
}

export default function NoteInput({ text, inputRef, onChange, onClear, suggestion }: Props) {
  const { isDark } = useTheme();

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
          {!text && suggestion && (
            <span className={`opacity-50 ${isDark ? "text-white" : "text-black"}`}>
              {suggestion.text.trimStart()}
            </span>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={suggestion ? `Tab for ${suggestion.label ?? "suggestion"}` : "Type a quick note..."}
          className={`relative w-full bg-transparent text-[20px] outline-none ${
            isDark
              ? "placeholder-white/40 caret-white"
              : "placeholder-black/40 caret-black"
          }`}
          style={{ color: "transparent" }}
          autoFocus
        />
      </div>

      {text && (
        <button
          onClick={onClear}
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isDark
              ? "bg-white/15 hover:bg-white/25"
              : "bg-black/15 hover:bg-black/25"
          }`}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
