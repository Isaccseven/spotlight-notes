import { invoke } from "@tauri-apps/api/core";

/** Token types recognised by the inline capture grammar. */
export type TokenType = "tag" | "time" | "issue" | "channel" | "text";

/** A single parsed segment of a note string (frontend lightweight parser). */
export interface Token {
  type: TokenType;
  text: string;
}

/** Colors used in the UI for each token type. */
export const TOKEN_COLORS: Record<TokenType, string> = {
  tag: "#7ee787",
  time: "#f07167",
  issue: "#79c0ff",
  channel: "#d2a8ff",
  text: "rgba(255,255,255,0.8)",
};

// ---------------------------------------------------------------------------
// Rust-shared protocol types
// ---------------------------------------------------------------------------

export type GrammarToken =
  | { type: "text"; content: string }
  | { type: "tag"; content: string }
  | { type: "time"; content: { raw: string; amount: number; unit: string } }
  | { type: "issue"; content: string }
  | { type: "channel"; content: string };

export interface ParsedNote {
  raw: string;
  tokens: GrammarToken[];
  tags: string[];
  delays_ms: number[];
  issues: string[];
  channels: string[];
  clean_body: string;
}

/** Parse a note string via the canonical Rust grammar parser. */
export async function parseNoteWithRust(text: string): Promise<ParsedNote> {
  return await invoke<ParsedNote>("parse_note_command", { text });
}

// ---------------------------------------------------------------------------
// Frontend lightweight parser (live highlighting only)
// ---------------------------------------------------------------------------

function classifyToken(text: string): TokenType {
  if (text.startsWith("#")) return "tag";
  if (/^@\d+[smhd]$/i.test(text)) return "time";
  if (/^@issue/i.test(text)) return "issue";
  if (/^@channel/i.test(text)) return "channel";
  if (text.startsWith("@")) return "channel"; // generic @mention falls to channel
  return "text";
}

function isTokenChar(char: string): boolean {
  return /[a-zA-Z0-9_/-]/.test(char);
}

function shouldEnterTokenMode(text: string, pos: number): boolean {
  if (pos === 0) return true;
  return /\W/.test(text[pos - 1]);
}

function mergeConsecutiveText(tokens: Token[]): Token[] {
  const result: Token[] = [];
  let currentText = "";

  for (const token of tokens) {
    if (token.type === "text") {
      currentText += token.text;
    } else {
      if (currentText) {
        result.push({ type: "text", text: currentText });
        currentText = "";
      }
      result.push(token);
    }
  }

  if (currentText) {
    result.push({ type: "text", text: currentText });
  }

  return result;
}

/**
 * Parse a note string into typed tokens for live UI highlighting.
 * This is a lightweight frontend mirror of the canonical Rust parser.
 * For save-time canonical parsing, use {@link parseNoteWithRust}.
 */
export function parseTokens(text: string): Token[] {
  if (!text) return [];

  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if ((char === "#" || char === "@") && shouldEnterTokenMode(text, i)) {
      const start = i;
      i++;

      if (char === "#") {
        while (i < text.length && isTokenChar(text[i])) {
          i++;
        }
        const tokenText = text.slice(start, i);
        if (tokenText.length > 1) {
          tokens.push({ type: "tag", text: tokenText });
        } else {
          tokens.push({ type: "text", text: "#" });
        }
      } else {
        // Try to parse @time: @\d+[smhd]
        if (i < text.length && /\d/.test(text[i])) {
          const numStart = i;
          while (i < text.length && /\d/.test(text[i])) {
            i++;
          }
          if (i < text.length && /[smhd]/i.test(text[i])) {
            i++;
            tokens.push({ type: "time", text: text.slice(start, i) });
            continue;
          }
          // Not a valid time token — backtrack to after @
          i = numStart;
        }

        while (i < text.length && isTokenChar(text[i])) {
          i++;
        }
        const tokenText = text.slice(start, i);
        if (tokenText.length > 1) {
          tokens.push({ type: classifyToken(tokenText), text: tokenText });
        } else {
          tokens.push({ type: "text", text: "@" });
        }
      }
    } else {
      // Collect plain text until next potential token start
      const textStart = i;
      while (i < text.length) {
        const c = text[i];
        if ((c === "#" || c === "@") && shouldEnterTokenMode(text, i)) {
          break;
        }
        i++;
      }
      tokens.push({ type: "text", text: text.slice(textStart, i) });
    }
  }

  return mergeConsecutiveText(tokens);
}

/** Extract every #tag from a string (without the leading #). */
export function extractTags(text: string): string[] {
  const tags: string[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === "#" && shouldEnterTokenMode(text, i)) {
      const start = i;
      i++;
      while (i < text.length && isTokenChar(text[i])) {
        i++;
      }
      const tokenText = text.slice(start, i);
      if (tokenText.length > 1) {
        tags.push(tokenText.slice(1).toLowerCase());
      }
    } else {
      i++;
    }
  }

  return [...new Set(tags)];
}

/** Extract every @time token from a string. */
export function extractTimeTokens(text: string): string[] {
  const times: string[] = [];
  const pattern = /@\d+[smhd]/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    times.push(m[0]);
  }
  return times;
}
