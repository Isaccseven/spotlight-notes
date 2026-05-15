import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrace = vi.fn();
const mockDebug = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock("@tauri-apps/plugin-log", () => ({
  trace: mockTrace,
  debug: mockDebug,
  info: mockInfo,
  warn: mockWarn,
  error: mockError,
}));

describe("initLogging / forwardConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards console.log to Tauri trace", async () => {
    const { initLogging } = await import("@/lib/logging/logger");
    initLogging();
    console.log("hello log");
    expect(mockTrace).toHaveBeenCalledWith("hello log");
  });

  it("forwards console.debug to Tauri debug", async () => {
    const { initLogging } = await import("@/lib/logging/logger");
    initLogging();
    console.debug("hello debug");
    expect(mockDebug).toHaveBeenCalledWith("hello debug");
  });

  it("forwards console.info to Tauri info", async () => {
    const { initLogging } = await import("@/lib/logging/logger");
    initLogging();
    console.info("hello info");
    expect(mockInfo).toHaveBeenCalledWith("hello info");
  });

  it("forwards console.warn to Tauri warn", async () => {
    const { initLogging } = await import("@/lib/logging/logger");
    initLogging();
    console.warn("hello warn");
    expect(mockWarn).toHaveBeenCalledWith("hello warn");
  });

  it("forwards console.error to Tauri error", async () => {
    const { initLogging } = await import("@/lib/logging/logger");
    initLogging();
    console.error("hello error");
    expect(mockError).toHaveBeenCalledWith("hello error");
  });
});
