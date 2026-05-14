import { describe, it, expect } from "vitest";

describe("store config", () => {
  it("has the correct default store options", async () => {
    const { storeOptions } = await import("@/lib/store/config");
    expect(storeOptions.autoSave).toBe(true);
    expect(storeOptions.defaults).toEqual({});
  });

  it("STORE_PATH and STORAGE_KEY are consistent", async () => {
    const { STORE_PATH: sp, STORAGE_KEY: sk } = await import(
      "@/lib/store/config"
    );
    expect(sp).toBe(`${sk}.json`);
  });
});

describe("shortcut constants", () => {
  it("exports expected values", async () => {
    const mod = await import("@/lib/shortcut/constants");
    expect(mod.GLOBAL_SHORTCUTS_KEY).toBe("Command+Shift+W");
    expect(mod.DEBOUNCE_DELAY).toBe(500);
  });
});
