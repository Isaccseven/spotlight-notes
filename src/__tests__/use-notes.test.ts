import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Note } from "@/types/note";

const STORAGE_KEY = "notes";

function createMockStore() {
  let data: Record<string, unknown> = {};
  return {
    get: vi.fn(async <T>(key: string): Promise<T | null> =>
      key === STORAGE_KEY ? (data[key] as T) ?? null : null,
    ),
    set: vi.fn(async (key: string, value: unknown) => {
      if (key === STORAGE_KEY) data[key] = value;
    }),
  };
}

const mockStore = createMockStore();

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue(mockStore),
}));

vi.mock("@tauri-apps/api/window", () => {
  const hide = vi.fn().mockResolvedValue(undefined);
  const show = vi.fn().mockResolvedValue(undefined);
  const setFocus = vi.fn().mockResolvedValue(undefined);
  const isVisible = vi.fn().mockResolvedValue(true);
  const onFocusChanged = vi.fn().mockReturnValue(
    Promise.resolve(vi.fn()),
  );
  return {
    getCurrentWindow: vi.fn().mockReturnValue({
      hide,
      show,
      setFocus,
      isVisible,
      onFocusChanged,
    }),
  };
});

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  sendNotification: vi.fn(),
}));

describe("useNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads saved notes from store on mount", async () => {
    const saved: Note[] = [
      { id: "1", text: "saved note" },
    ];
    mockStore.get.mockResolvedValue(saved);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toEqual(saved);
    });
  });

  it("starts with empty state when no saved notes", async () => {
    mockStore.get.mockResolvedValue(null);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    expect(result.current.notes).toEqual([]);
    expect(result.current.text).toBe("");
    expect(result.current.focusedIndex).toBeNull();
  });

  it("saveNote creates a note and persists it", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await act(async () => {
      result.current.setText("hello world");
    });

    await act(async () => {
      await result.current.handleInputKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].text).toBe("hello world");
    expect(result.current.notes[0].id).toBeTruthy();
    expect(result.current.text).toBe("");
    expect(mockStore.set).toHaveBeenCalledWith(STORAGE_KEY, result.current.notes);
  });

  it("saveNote does nothing for empty/whitespace text", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await act(async () => {
      result.current.setText("   ");
    });

    await act(async () => {
      await result.current.handleInputKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.notes).toHaveLength(0);
  });

  it("saveNote registers notification when text contains @", async () => {
    vi.useFakeTimers();
    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    const sendNotification = (await import("@tauri-apps/plugin-notification"))
      .sendNotification;

    await act(async () => {
      result.current.setText("remind me @10s");
    });

    await act(async () => {
      await result.current.handleInputKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(sendNotification).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("deleteNote removes a note by index and persists", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");

    mockStore.get.mockResolvedValue([
      { id: "1", text: "first" },
      { id: "2", text: "second" },
      { id: "3", text: "third" },
    ]);

    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(3);
    });

    await act(async () => {
      await result.current.deleteNote(1);
    });

    expect(result.current.notes).toHaveLength(2);
    expect(result.current.notes[0].id).toBe("1");
    expect(result.current.notes[1].id).toBe("3");
    expect(mockStore.set).toHaveBeenCalled();
  });

  it("handleInputKeyDown with Tab moves focus to first note", async () => {
    mockStore.get.mockResolvedValue([
      { id: "1", text: "note 1" },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    await act(async () => {
      result.current.handleInputKeyDown({
        key: "Tab",
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("handleNoteKeyDown with Backspace deletes and focuses previous", async () => {
    mockStore.get.mockResolvedValue([
      { id: "1", text: "first" },
      { id: "2", text: "second" },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(2);
    });

    await act(async () => {
      result.current.handleNoteKeyDown(
        { key: "Backspace", preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        0,
      );
    });

    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].text).toBe("second");
  });

  it("handleNoteKeyDown with Escape focuses input", async () => {
    mockStore.get.mockResolvedValue([
      { id: "1", text: "note" },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    await act(async () => {
      result.current.handleNoteKeyDown(
        { key: "Escape", preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        0,
      );
    });

    expect(result.current.focusedIndex).toBeNull();
  });

  it("Escape on input clears text when non-empty", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await act(async () => {
      result.current.setText("some text");
    });

    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      result.current.inputRef.current = input;
      input.focus();
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    await vi.waitFor(() => {
      expect(result.current.text).toBe("");
    });

    document.body.innerHTML = "";
  });

  it("prepends new notes (most recent first)", async () => {
    mockStore.get.mockResolvedValue([
      { id: "1", text: "existing" },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    await act(async () => {
      result.current.setText("newest");
    });

    await act(async () => {
      await result.current.handleInputKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.notes).toHaveLength(2);
    expect(result.current.notes[0].text).toBe("newest");
    expect(result.current.notes[1].text).toBe("existing");
  });
});
