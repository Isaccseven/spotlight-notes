import { useState } from "react";
import { ExportFormat } from "@/lib/export/formatters";
import { Note } from "@/types/note";

interface Props {
  notes: Note[];
  open: boolean;
  exporting: boolean;
  onExport: (format: ExportFormat) => void;
  onClose: () => void;
}

const FORMATS: { key: ExportFormat; label: string }[] = [
  { key: "markdown-single", label: "Markdown (single file)" },
  { key: "markdown-multi", label: "Markdown (per note)" },
  { key: "json", label: "JSON" },
  { key: "opml", label: "OPML" },
];

export default function ExportPanel({ notes, open, exporting, onExport, onClose }: Props) {
  const [selected, setSelected] = useState<ExportFormat>("markdown-single");

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 top-full z-50 px-3 pt-2">
      <div className="bg-[#1a1a1a]/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl p-4 max-w-[640px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white/90 text-sm font-medium">Export {notes.length} note{notes.length === 1 ? "" : "s"}</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xs transition-colors"
          >
            Esc to close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.key}
              onClick={() => setSelected(fmt.key)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selected === fmt.key
                  ? "bg-white/15 text-white"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs">
            Files will be saved to a directory of your choice
          </span>
          <button
            onClick={() => onExport(selected)}
            disabled={exporting || notes.length === 0}
            className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? "Exporting..." : "Choose Folder"}
          </button>
        </div>
      </div>
    </div>
  );
}
