import { describe, it, expect } from "vitest";

function parseDelayMs(message: string): number | null {
  const partAfterAt = message.split("@")[1];
  if (!partAfterAt) return null;

  const match = partAfterAt.trim().match(/^(\d+)([smhd])/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const unitToMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * unitToMs[unit];
}

describe("parseDelayMs", () => {
  it("returns null when there is no @ symbol", () => {
    expect(parseDelayMs("hello world")).toBeNull();
  });

  it("returns null when there is nothing after @", () => {
    expect(parseDelayMs("remind me @")).toBeNull();
  });

  it("returns null when the delay format is invalid after @", () => {
    expect(parseDelayMs("remind me @abc")).toBeNull();
  });

  it("parses seconds correctly", () => {
    expect(parseDelayMs("do something @30s")).toBe(30_000);
    expect(parseDelayMs("do something @1s")).toBe(1_000);
  });

  it("parses minutes correctly", () => {
    expect(parseDelayMs("do something @5m")).toBe(300_000);
    expect(parseDelayMs("do something @1m")).toBe(60_000);
  });

  it("parses hours correctly", () => {
    expect(parseDelayMs("do something @2h")).toBe(7_200_000);
  });

  it("parses days correctly", () => {
    expect(parseDelayMs("do something @1d")).toBe(86_400_000);
  });

  it("handles uppercase units", () => {
    expect(parseDelayMs("do something @10S")).toBe(10_000);
    expect(parseDelayMs("do something @5M")).toBe(300_000);
    expect(parseDelayMs("do something @1H")).toBe(3_600_000);
    expect(parseDelayMs("do something @1D")).toBe(86_400_000);
  });

  it("ignores trailing whitespace around the delay", () => {
    expect(parseDelayMs("test @  10s")).toBe(10_000);
  });

  it("parses multi-digit amounts correctly", () => {
    expect(parseDelayMs("test @3600s")).toBe(3_600_000);
  });

  it("returns null for partial units", () => {
    expect(parseDelayMs("test @5")).toBeNull();
  });
});
