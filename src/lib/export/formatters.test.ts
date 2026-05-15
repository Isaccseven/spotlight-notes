import { describe, it, expect, vi } from "vitest";
import {
  toMarkdownSingle,
  toMarkdownPerNote,
  toJSON,
  toOPML,
  formatNotes,
  escapeXml,
} from "./formatters";
import { Note } from "@/types/note";

const mockDate = "2024-01-01T00:00:00.000Z";
vi.stubGlobal("Date", class extends Date {
  constructor() {
    super(mockDate);
  }
  toISOString() {
    return mockDate;
  }
});

function makeNote(overrides: Partial<Note> & { id: string; text: string }): Note {
  return {
    createdAt: Date.now(),
    pinned: false,
    ...overrides,
  };
}

describe("export formatters", () => {
  const notes: Note[] = [
    makeNote({ id: "1", text: "Hello world" }),
    makeNote({ id: "2", text: "Buy milk & eggs" }),
  ];

  describe("toMarkdownSingle", () => {
    it("returns a single markdown file with all notes", () => {
      const result = toMarkdownSingle(notes);
      expect(result.filename).toBe("notes.md");
      expect(result.content).toContain("# Spotlight Notes Export");
      expect(result.content).toContain("## Note 1");
      expect(result.content).toContain("Hello world");
      expect(result.content).toContain("## Note 2");
      expect(result.content).toContain("Buy milk & eggs");
      expect(result.content).toContain(`Generated: ${mockDate}`);
    });

    it("returns empty sections when no notes", () => {
      const result = toMarkdownSingle([]);
      expect(result.content).toContain("# Spotlight Notes Export");
      expect(result.content).not.toContain("## Note");
    });
  });

  describe("toMarkdownPerNote", () => {
    it("returns one file per note", () => {
      const result = toMarkdownPerNote(notes);
      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe("hello-world.md");
      expect(result[0].content).toContain("# Note 1");
      expect(result[0].content).toContain("Hello world");
      expect(result[1].filename).toBe("buy-milk-eggs.md");
      expect(result[1].content).toContain("# Note 2");
      expect(result[1].content).toContain("Buy milk & eggs");
    });

    it("falls back to note-index filename when text is empty", () => {
      const result = toMarkdownPerNote([makeNote({ id: "3", text: "" })]);
      expect(result[0].filename).toBe("note-1.md");
    });

    it("sanitizes special characters from filenames", () => {
      const result = toMarkdownPerNote([
        makeNote({ id: "4", text: "Test @home!" }),
      ]);
      expect(result[0].filename).toBe("test-home.md");
    });
  });

  describe("toJSON", () => {
    it("returns a JSON file with notes and metadata", () => {
      const result = toJSON(notes);
      expect(result.filename).toBe("notes.json");
      const parsed = JSON.parse(result.content);
      expect(parsed.exportedAt).toBe(mockDate);
      expect(parsed.count).toBe(2);
      expect(parsed.notes).toEqual(notes);
    });
  });

  describe("toOPML", () => {
    it("returns an OPML file with outlines", () => {
      const result = toOPML(notes);
      expect(result.filename).toBe("notes.opml");
      expect(result.content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.content).toContain("<opml version=\"2.0\">");
      expect(result.content).toContain("<title>Spotlight Notes</title>");
      expect(result.content).toContain('<outline text="Hello world" />');
    });

    it("escapes XML special characters in note text", () => {
      const result = toOPML([makeNote({ id: "5", text: 'A & B < C > D "E"' })]);
      expect(result.content).toContain('A &amp; B &lt; C &gt; D &quot;E&quot;');
    });
  });

  describe("formatNotes", () => {
    it("delegates to the correct formatter", () => {
      expect(formatNotes(notes, "markdown-single")[0].filename).toBe("notes.md");
      expect(formatNotes(notes, "markdown-multi")).toHaveLength(2);
      expect(formatNotes(notes, "json")[0].filename).toBe("notes.json");
      expect(formatNotes(notes, "opml")[0].filename).toBe("notes.opml");
    });

    it("defaults to json for unknown format", () => {
      expect(formatNotes(notes, "unknown" as never)[0].filename).toBe("notes.json");
    });
  });

  describe("escapeXml", () => {
    it("escapes all XML special characters", () => {
      const input = `& < > " '`;
      const expected = "&amp; &lt; &gt; &quot; &apos;";
      expect(escapeXml(input)).toBe(expected);
    });
  });
});
