import { describe, it, expect } from "vitest";
import {
  parseTokens,
  extractTags,
  extractTimeTokens,
  TOKEN_COLORS,
  parseNoteWithRust,
} from "@/lib/grammar";

describe("parseTokens", () => {
  it("returns empty array for empty string", () => {
    expect(parseTokens("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseTokens("   ")).toEqual([{ type: "text", text: "   " }]);
  });

  it("parses plain text", () => {
    expect(parseTokens("hello world")).toEqual([
      { type: "text", text: "hello world" },
    ]);
  });

  it("parses a #tag", () => {
    expect(parseTokens("hello #world")).toEqual([
      { type: "text", text: "hello " },
      { type: "tag", text: "#world" },
    ]);
  });

  it("parses @time tokens", () => {
    expect(parseTokens("remind me @10s")).toEqual([
      { type: "text", text: "remind me " },
      { type: "time", text: "@10s" },
    ]);
  });

  it("parses @issue tokens", () => {
    expect(parseTokens("fix @issue-123")).toEqual([
      { type: "text", text: "fix " },
      { type: "issue", text: "@issue-123" },
    ]);
  });

  it("parses @channel tokens", () => {
    expect(parseTokens("ask @channel/dev")).toEqual([
      { type: "text", text: "ask " },
      { type: "channel", text: "@channel/dev" },
    ]);
  });

  it("parses generic @mention as channel", () => {
    expect(parseTokens("hi @john")).toEqual([
      { type: "text", text: "hi " },
      { type: "channel", text: "@john" },
    ]);
  });

  it("parses multiple tokens in one string", () => {
    expect(parseTokens("#work fix @issue-42 @5m")).toEqual([
      { type: "tag", text: "#work" },
      { type: "text", text: " fix " },
      { type: "issue", text: "@issue-42" },
      { type: "text", text: " " },
      { type: "time", text: "@5m" },
    ]);
  });

  it("does not parse email-like strings", () => {
    expect(parseTokens("contact me@example.com")).toEqual([
      { type: "text", text: "contact me@example.com" },
    ]);
  });

  it("parses token at the start of string", () => {
    expect(parseTokens("#tag hello")).toEqual([
      { type: "tag", text: "#tag" },
      { type: "text", text: " hello" },
    ]);
  });

  it("parses token at the end of string", () => {
    expect(parseTokens("hello #tag")).toEqual([
      { type: "text", text: "hello " },
      { type: "tag", text: "#tag" },
    ]);
  });

  it("parses only tokens with no surrounding text", () => {
    expect(parseTokens("#a #b")).toEqual([
      { type: "tag", text: "#a" },
      { type: "text", text: " " },
      { type: "tag", text: "#b" },
    ]);
  });

  it("parses consecutive tokens with no space between", () => {
    // The regex uses negative lookbehind so #b is not matched after #a
    expect(parseTokens("#a#b")).toEqual([
      { type: "tag", text: "#a" },
      { type: "text", text: "#b" },
    ]);
  });

  it("parses tags with hyphens and slashes", () => {
    expect(parseTokens("#bug-fix #channel/dev")).toEqual([
      { type: "tag", text: "#bug-fix" },
      { type: "text", text: " " },
      { type: "tag", text: "#channel/dev" },
    ]);
  });

  it("parses all time units: s, m, h, d", () => {
    expect(parseTokens("@1s @2m @3h @4d")).toEqual([
      { type: "time", text: "@1s" },
      { type: "text", text: " " },
      { type: "time", text: "@2m" },
      { type: "text", text: " " },
      { type: "time", text: "@3h" },
      { type: "text", text: " " },
      { type: "time", text: "@4d" },
    ]);
  });

  it("parses time tokens case-insensitively", () => {
    expect(parseTokens("@10S @5M @1H @2D")).toEqual([
      { type: "time", text: "@10S" },
      { type: "text", text: " " },
      { type: "time", text: "@5M" },
      { type: "text", text: " " },
      { type: "time", text: "@1H" },
      { type: "text", text: " " },
      { type: "time", text: "@2D" },
    ]);
  });

  it("parses @issue without number as issue", () => {
    expect(parseTokens("check @issue")).toEqual([
      { type: "text", text: "check " },
      { type: "issue", text: "@issue" },
    ]);
  });

  it("parses @channel without path as channel", () => {
    expect(parseTokens("post to @channel")).toEqual([
      { type: "text", text: "post to " },
      { type: "channel", text: "@channel" },
    ]);
  });

  it("does not parse @ alone as token", () => {
    expect(parseTokens("hello @ world")).toEqual([
      { type: "text", text: "hello @ world" },
    ]);
  });

  it("does not parse # alone as token", () => {
    expect(parseTokens("hello # world")).toEqual([
      { type: "text", text: "hello # world" },
    ]);
  });

  it("does not parse invalid time format as time", () => {
    expect(parseTokens("wait @5x")).toEqual([
      { type: "text", text: "wait " },
      { type: "channel", text: "@5x" },
    ]);
  });

  it("handles multiple spaces between tokens", () => {
    expect(parseTokens("hello   #tag   @5m")).toEqual([
      { type: "text", text: "hello   " },
      { type: "tag", text: "#tag" },
      { type: "text", text: "   " },
      { type: "time", text: "@5m" },
    ]);
  });

  it("handles unicode and emoji text", () => {
    expect(parseTokens("hello 🎉 #party @10m")).toEqual([
      { type: "text", text: "hello 🎉 " },
      { type: "tag", text: "#party" },
      { type: "text", text: " " },
      { type: "time", text: "@10m" },
    ]);
  });

  it("handles a complex real-world note", () => {
    expect(
      parseTokens(
        "#work fix login bug @issue-42 @5m then deploy to @channel/dev #urgent"
      )
    ).toEqual([
      { type: "tag", text: "#work" },
      { type: "text", text: " fix login bug " },
      { type: "issue", text: "@issue-42" },
      { type: "text", text: " " },
      { type: "time", text: "@5m" },
      { type: "text", text: " then deploy to " },
      { type: "channel", text: "@channel/dev" },
      { type: "text", text: " " },
      { type: "tag", text: "#urgent" },
    ]);
  });

  it("handles numbers in tags", () => {
    expect(parseTokens("#v2 #123 #abc123")).toEqual([
      { type: "tag", text: "#v2" },
      { type: "text", text: " " },
      { type: "tag", text: "#123" },
      { type: "text", text: " " },
      { type: "tag", text: "#abc123" },
    ]);
  });

  it("parses trailing text after last token", () => {
    expect(parseTokens("#tag some text")).toEqual([
      { type: "tag", text: "#tag" },
      { type: "text", text: " some text" },
    ]);
  });

  it("handles repeated calls without state leakage", () => {
    const first = parseTokens("#a");
    const second = parseTokens("#b");
    expect(first).toEqual([{ type: "tag", text: "#a" }]);
    expect(second).toEqual([{ type: "tag", text: "#b" }]);
  });
});

describe("extractTags", () => {
  it("returns empty array when no tags", () => {
    expect(extractTags("no tags here")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractTags("")).toEqual([]);
  });

  it("extracts tags without leading #", () => {
    expect(extractTags("hello #world")).toEqual(["world"]);
  });

  it("extracts multiple tags and deduplicates", () => {
    expect(extractTags("#work #work #personal")).toEqual([
      "work",
      "personal",
    ]);
  });

  it("normalizes to lowercase", () => {
    expect(extractTags("#WORK #Urgent")).toEqual(["work", "urgent"]);
  });

  it("extracts tags with hyphens and slashes", () => {
    expect(extractTags("#bug-fix #feat/new")).toEqual(["bug-fix", "feat/new"]);
  });

  it("extracts tags with numbers", () => {
    expect(extractTags("#v2 #123 #abc123")).toEqual(["v2", "123", "abc123"]);
  });

  it("does not extract tags adjacent to word characters", () => {
    expect(extractTags("abc#tag")).toEqual([]);
  });

  it("does not extract standalone #", () => {
    expect(extractTags("hello # world")).toEqual([]);
  });

  it("deduplicates case-insensitively", () => {
    expect(extractTags("#Work #WORK #work")).toEqual(["work"]);
  });

  it("extracts tags from complex note", () => {
    expect(
      extractTags("#work fix #bug @5m #urgent #work"),
    ).toEqual(["work", "bug", "urgent"]);
  });
});

describe("extractTimeTokens", () => {
  it("returns empty array when no time tokens", () => {
    expect(extractTimeTokens("no reminder")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractTimeTokens("")).toEqual([]);
  });

  it("extracts @time tokens", () => {
    expect(extractTimeTokens("remind me @10s")).toEqual(["@10s"]);
  });

  it("extracts multiple time tokens", () => {
    expect(extractTimeTokens("@1m and @2h")).toEqual(["@1m", "@2h"]);
  });

  it("extracts all time units", () => {
    expect(extractTimeTokens("@1s @2m @3h @4d")).toEqual([
      "@1s",
      "@2m",
      "@3h",
      "@4d",
    ]);
  });

  it("extracts time tokens case-insensitively", () => {
    expect(extractTimeTokens("@10S @5M @1H @2D")).toEqual([
      "@10S",
      "@5M",
      "@1H",
      "@2D",
    ]);
  });

  it("does not extract invalid time format", () => {
    expect(extractTimeTokens("@5x @abc @10")).toEqual([]);
  });

  it("extracts only valid time tokens from mixed input", () => {
    expect(extractTimeTokens("@5m @xyz @10s")).toEqual(["@5m", "@10s"]);
  });

  it("extracts time tokens with larger numbers", () => {
    expect(extractTimeTokens("@999s @1440m")).toEqual(["@999s", "@1440m"]);
  });

  it("extracts time tokens from complex note", () => {
    expect(
      extractTimeTokens("remind me @5m about #work @1h later"),
    ).toEqual(["@5m", "@1h"]);
  });
});

describe("TOKEN_COLORS", () => {
  it("has colors for all token types", () => {
    expect(TOKEN_COLORS.tag).toBeTruthy();
    expect(TOKEN_COLORS.time).toBeTruthy();
    expect(TOKEN_COLORS.issue).toBeTruthy();
    expect(TOKEN_COLORS.channel).toBeTruthy();
    expect(TOKEN_COLORS.text).toBeTruthy();
  });
});

describe("parseNoteWithRust", () => {
  it("returns parsed note from Rust command", async () => {
    const parsed = await parseNoteWithRust("meeting notes #work @10s");
    expect(parsed.raw).toBe("meeting notes #work @10s");
    expect(parsed.tags).toContain("work");
    expect(parsed.delays_ms).toContain(10_000);
    expect(parsed.clean_body).toBe("meeting notes");
  });

  it("returns empty delays for plain text", async () => {
    const parsed = await parseNoteWithRust("plain text");
    expect(parsed.delays_ms).toEqual([]);
    expect(parsed.tags).toEqual([]);
    expect(parsed.clean_body).toBe("plain text");
  });

  it("extracts issues and channels", async () => {
    const parsed = await parseNoteWithRust("fix @issue-123 ask @channel/dev");
    expect(parsed.issues).toContain("-123");
    expect(parsed.channels).toContain("dev");
  });

  it("deduplicates tags", async () => {
    const parsed = await parseNoteWithRust("#foo #bar #foo");
    expect(parsed.tags).toEqual(["foo", "bar"]);
  });

  it("normalises tags to lowercase", async () => {
    const parsed = await parseNoteWithRust("#WORK #Urgent");
    expect(parsed.tags).toEqual(["work", "urgent"]);
  });
});
