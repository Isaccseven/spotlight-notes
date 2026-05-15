import { Note } from "@/types/note";

export type ExportFile = {
  filename: string;
  content: string;
};

export type ExportFormat = "markdown-single" | "markdown-multi" | "json" | "opml";

export function toMarkdownSingle(notes: Note[]): ExportFile {
  const lines = [
    "# Spotlight Notes Export",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "---",
    "",
  ];

  notes.forEach((note, i) => {
    lines.push(`## Note ${i + 1}`);
    lines.push("");
    lines.push(note.text);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return { filename: "notes.md", content: lines.join("\n") };
}

function sanitizeFilename(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .toLowerCase();
}

export function toMarkdownPerNote(notes: Note[]): ExportFile[] {
  return notes.map((note, i) => {
    const slug = sanitizeFilename(note.text) || `note-${i + 1}`;
    const content = [`# Note ${i + 1}`, "", note.text, ""].join("\n");
    return { filename: `${slug}.md`, content };
  });
}

export function toJSON(notes: Note[]): ExportFile {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: notes.length,
    notes,
  };
  return { filename: "notes.json", content: JSON.stringify(payload, null, 2) };
}

export function toOPML(notes: Note[]): ExportFile {
  const outlines = notes
    .map((note) => `    <outline text="${escapeXml(note.text)}" />`)
    .join("\n");

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Spotlight Notes</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;

  return { filename: "notes.opml", content };
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatNotes(notes: Note[], format: ExportFormat): ExportFile[] {
  switch (format) {
    case "markdown-single":
      return [toMarkdownSingle(notes)];
    case "markdown-multi":
      return toMarkdownPerNote(notes);
    case "json":
      return [toJSON(notes)];
    case "opml":
      return [toOPML(notes)];
    default:
      return [toJSON(notes)];
  }
}
