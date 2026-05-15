import { useState, useEffect, useRef } from "react";

interface Props {
  open: boolean;
  output: string;
  onClose: () => void;
  onRun: () => void;
  onChange: (value: string) => void;
}

export default function ShellCommandModal({ open, output, onClose, onRun, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 top-full z-50 px-3 pt-2">
      <div className="bg-[#1a1a1a]/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl p-4 max-w-[640px] mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white/90 text-sm font-medium">Run Shell Command</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xs transition-colors"
          >
            Esc to close
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-white/50 text-sm select-none">$</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRun();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="pbcopy"
            className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder-white/30"
          />
        </div>

        {output && (
          <div className="mt-2 p-2 rounded-lg bg-black/30 text-white/70 text-xs font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {output}
          </div>
        )}
      </div>
    </div>
  );
}
