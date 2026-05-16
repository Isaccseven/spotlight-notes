import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Note } from "@/types/note";

const STORAGE_KEY = "notes";

function createMockStore() {
  const data: Record<string, unknown> = {};
  return {
    get: vi.fn(async <T>(key: string): Promise<T | null> => (data[key] as T) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      data[key] = value;
    }),
    _setData: (key: string, value: unknown) => {
      data[key] = value;
    },
    _clear: () => {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
    },
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
    mockStore._clear();
    vi.clearAllMocks();
  });

  it("loads saved notes from store on mount", async () => {
    const saved: Note[] = [
      { id: "1", text: "saved note", createdAt: 1000, pinned: false },
    ];
    mockStore._setData("notes",saved);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toEqual(saved);
    });
  });

  it("starts with empty state when no saved notes", async () => {
    mockStore._setData("notes",null);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    expect(result.current.notes).toEqual([]);
    expect(result.current.text).toBe("");
    expect(result.current.focusedIndex).toBeNull();
  });

  it("saveNote creates a note and persists it", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    act(() => {
      result.current.setText("hello world");
    });

    act(() => {
      result.current.submit();
    });

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    expect(result.current.notes[0].text).toBe("hello world");
    expect(result.current.notes[0].id).toBeTruthy();
    expect(result.current.notes[0].pinned).toBe(false);
    expect(result.current.notes[0].createdAt).toBeTruthy();
    expect(result.current.text).toBe("");
    expect(mockStore.set).toHaveBeenCalledWith(STORAGE_KEY, result.current.notes);
  });

  it("saveNote does nothing for empty/whitespace text", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    act(() => {
      result.current.setText("   ");
    });

    act(() => {
      result.current.submit();
    });

    expect(result.current.notes).toHaveLength(0);
  });

  it("saveNote invokes parse_note_command and register_notification when text contains @", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    const { invoke } = await import("@tauri-apps/api/core");

    act(() => {
      result.current.setText("remind me @10s");
    });

    act(() => {
      result.current.submit();
    });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("parse_note_command", {
        text: "remind me @10s",
      });
    });
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("register_notification", {
        message: "remind me @10s",
      });
    });
  });

  it("deleteNote removes a note by id and persists", async () => {
    const { useNotes } = await import("@/lib/store/use-notes");

    mockStore._setData("notes",[
      { id: "1", text: "first", createdAt: 1000, pinned: false },
      { id: "2", text: "second", createdAt: 2000, pinned: false },
      { id: "3", text: "third", createdAt: 3000, pinned: false },
    ]);

    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(3);
    });

    act(() => {
      result.current.deleteNote("2");
    });

    expect(result.current.notes).toHaveLength(2);
    expect(result.current.notes[0].id).toBe("1");
    expect(result.current.notes[1].id).toBe("3");
    expect(mockStore.set).toHaveBeenCalled();
  });

  it("focus moves focus to first note", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "note 1", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    act(() => {
      result.current.focus(0);
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("deleteNote removes a note and resets focus", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "first", createdAt: 1000, pinned: false },
      { id: "2", text: "second", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(2);
    });

    act(() => {
      result.current.focus(0);
    });

    act(() => {
      result.current.deleteNote("1");
    });

    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].text).toBe("second");
  });

  it("focusInput resets focus to null", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "note", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    act(() => {
      result.current.focus(0);
    });

    expect(result.current.focusedIndex).toBe(0);

    act(() => {
      result.current.focusInput();
    });

    expect(result.current.focusedIndex).toBeNull();
  });

  it("prepends new notes (most recent first)", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "existing", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    act(() => {
      result.current.setText("newest");
    });

    act(() => {
      result.current.submit();
    });

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(2);
    });

    expect(result.current.notes[0].text).toBe("newest");
    expect(result.current.notes[1].text).toBe("existing");
  });

  it("filteredNotes returns all notes when text is empty", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "alpha", createdAt: 1000, pinned: false },
      { id: "2", text: "beta", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(2);
    });

    expect(result.current.filteredNotes).toHaveLength(2);
    expect(result.current.filteredNotes[0].text).toBe("alpha");
    expect(result.current.filteredNotes[1].text).toBe("beta");
  });

  it("filteredNotes filters notes by text query", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "buy milk", createdAt: 1000, pinned: false },
      { id: "2", text: "call mom", createdAt: 1000, pinned: false },
      { id: "3", text: "milkshake", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(3);
    });

    act(() => {
      result.current.setText("milk");
    });

    expect(result.current.filteredNotes).toHaveLength(2);
    expect(result.current.filteredNotes[0].id).toBe("1");
    expect(result.current.filteredNotes[1].id).toBe("3");
  });

  it("filteredNotes is case-insensitive", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "Buy Milk", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    act(() => {
      result.current.setText("milk");
    });

    expect(result.current.filteredNotes).toHaveLength(1);
  });

  it("saving a note clears text and resets filteredNotes", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "alpha", createdAt: 1000, pinned: false },
      { id: "2", text: "beta", createdAt: 2000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(2);
    });

    act(() => {
      result.current.setText("alpha");
    });

    expect(result.current.filteredNotes).toHaveLength(1);

    act(() => {
      result.current.submit();
    });

    await vi.waitFor(() => {
      expect(result.current.text).toBe("");
    });

    expect(result.current.filteredNotes).toHaveLength(3);
  });

  it("togglePin toggles the pinned state of a note", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "note", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    act(() => {
      result.current.togglePin("1");
    });

    expect(result.current.notes[0].pinned).toBe(true);

    act(() => {
      result.current.togglePin("1");
    });

    expect(result.current.notes[0].pinned).toBe(false);
  });

  it("pinned notes sort to the top", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "older", createdAt: 1000, pinned: false },
      { id: "2", text: "newer", createdAt: 2000, pinned: true },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(2);
    });

    expect(result.current.filteredNotes[0].id).toBe("2");
    expect(result.current.filteredNotes[1].id).toBe("1");
  });

  it("getNoteTtl returns null for pinned notes", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "pinned", createdAt: Date.now(), pinned: true },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    expect(result.current.getNoteTtl(result.current.notes[0])).toBeNull();
  });

  it("getNoteTtl returns time remaining for unpinned notes", async () => {
    const now = Date.now();
    mockStore._setData("notes",[
      { id: "1", text: "unpinned", createdAt: now, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    const ttl = result.current.getNoteTtl(result.current.notes[0]);
    expect(ttl).toBeTruthy();
    expect(ttl).not.toBe("expired");
  });

  it("togglePin via action toggles pin", async () => {
    mockStore._setData("notes",[
      { id: "1", text: "note", createdAt: 1000, pinned: false },
    ]);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    await vi.waitFor(() => {
      expect(result.current.notes).toHaveLength(1);
    });

    act(() => {
      result.current.togglePin("1");
    });

    expect(result.current.notes[0].pinned).toBe(true);
  });

  it("settings loads with default TTL", async () => {
    mockStore._setData("notes",null);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    expect(result.current.settings.ttlHours).toBe(24);
  });

  it("setTtlHours updates settings and persists", async () => {
    mockStore._setData("notes",null);

    const { useNotes } = await import("@/lib/store/use-notes");
    const { result } = renderHook(() => useNotes());

    act(() => {
      result.current.setTtlHours(48);
    });

    expect(result.current.settings.ttlHours).toBe(48);
    expect(mockStore.set).toHaveBeenCalledWith("settings", { ttlHours: 48 });
  });

  describe("tags", () => {
    it("parses and stores tags on save", async () => {
      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      act(() => {
        result.current.setText("meeting notes #work #urgent");
      });

      act(() => {
        result.current.submit();
      });

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      expect(result.current.notes[0].tags).toEqual(["work", "urgent"]);
    });

    it("filters notes by tag when query starts with #", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo"] },
        { id: "2", text: "beta", createdAt: 1000, pinned: false, tags: ["bar"] },
        { id: "3", text: "gamma", createdAt: 1000, pinned: false, tags: ["foo", "baz"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(3);
      });

      act(() => {
        result.current.setText("#foo");
      });

      expect(result.current.filteredNotes).toHaveLength(2);
      expect(result.current.filteredNotes[0].id).toBe("1");
      expect(result.current.filteredNotes[1].id).toBe("3");
    });

    it("tagGroups groups notes by tag", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo"] },
        { id: "2", text: "beta", createdAt: 1000, pinned: false, tags: ["bar"] },
        { id: "3", text: "gamma", createdAt: 1000, pinned: false, tags: ["foo", "baz"] },
        { id: "4", text: "delta", createdAt: 1000, pinned: false },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(4);
      });

      expect(result.current.tagGroups).toHaveProperty("foo");
      expect(result.current.tagGroups).toHaveProperty("bar");
      expect(result.current.tagGroups).toHaveProperty("baz");
      expect(result.current.tagGroups.foo).toHaveLength(2);
      expect(result.current.tagGroups.bar).toHaveLength(1);
      expect(result.current.tagGroups.baz).toHaveLength(1);
    });

    it("getNotesByTag returns notes matching a tag", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo"] },
        { id: "2", text: "beta", createdAt: 1000, pinned: false, tags: ["bar"] },
        { id: "3", text: "gamma", createdAt: 1000, pinned: false, tags: ["foo", "baz"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(3);
      });

      const found = result.current.getNotesByTag("foo");
      expect(found).toHaveLength(2);
      expect(found[0].id).toBe("1");
      expect(found[1].id).toBe("3");
    });

    it("getNotesByTag is case-insensitive", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["Foo"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      expect(result.current.getNotesByTag("FOO")).toHaveLength(1);
    });

    it("getAllTags returns sorted unique tags", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "a", createdAt: 1000, pinned: false, tags: ["zebra"] },
        { id: "2", text: "b", createdAt: 1000, pinned: false, tags: ["apple", "zebra"] },
        { id: "3", text: "c", createdAt: 1000, pinned: false },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(3);
      });

      expect(result.current.getAllTags()).toEqual(["apple", "zebra"]);
    });

    it("addTag appends a new tag to a note", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.addTag("1", "bar");
      });

      expect(result.current.notes[0].tags).toEqual(["foo", "bar"]);
    });

    it("addTag normalizes to lowercase", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.addTag("1", "WORK");
      });

      expect(result.current.notes[0].tags).toEqual(["work"]);
    });

    it("addTag is idempotent for duplicate tags", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.addTag("1", "foo");
      });

      expect(result.current.notes[0].tags).toEqual(["foo"]);
    });

    it("removeTag deletes a tag from a note", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo", "bar"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.removeTag("1", "foo");
      });

      expect(result.current.notes[0].tags).toEqual(["bar"]);
    });

    it("removeTag normalizes to lowercase", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["work"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.removeTag("1", "WORK");
      });

      expect(result.current.notes[0].tags).toBeUndefined();
    });

    it("removeTag clears tags array when last tag is removed", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.removeTag("1", "foo");
      });

      expect(result.current.notes[0].tags).toBeUndefined();
    });
  });

  describe("buffer notes", () => {
    it("marks note as buffer when no tags or delay", async () => {
      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      act(() => {
        result.current.setText("quick thought");
      });

      act(() => {
        result.current.submit();
      });

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      expect(result.current.notes[0].buffer).toBe(true);
      expect(result.current.notes[0].tags).toBeUndefined();
    });

    it("does not mark note as buffer when it has tags", async () => {
      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      act(() => {
        result.current.setText("idea #project");
      });

      act(() => {
        result.current.submit();
      });

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      expect(result.current.notes[0].buffer).toBeUndefined();
      expect(result.current.notes[0].tags).toEqual(["project"]);
    });

    it("does not mark note as buffer when it has a delay", async () => {
      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      act(() => {
        result.current.setText("remind me @10m");
      });

      act(() => {
        result.current.submit();
      });

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      expect(result.current.notes[0].buffer).toBeUndefined();
    });

    it("classifyBuffer with tag removes buffer flag", async () => {
      const now = Date.now();
      mockStore._setData("notes",[
        { id: "1", text: "buffer", createdAt: now, pinned: false, buffer: true },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.classifyBuffer("1", "tag");
      });

      expect(result.current.notes[0].buffer).toBe(false);
    });

    it("classifyBuffer with remind adds @15m and removes buffer", async () => {
      const now = Date.now();
      mockStore._setData("notes",[
        { id: "1", text: "buffer", createdAt: now, pinned: false, buffer: true },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.classifyBuffer("1", "remind");
      });

      expect(result.current.notes[0].buffer).toBe(false);
      expect(result.current.notes[0].text).toBe("buffer @15m");
    });

    it("classifyBuffer with discard deletes the note", async () => {
      const now = Date.now();
      mockStore._setData("notes",[
        { id: "1", text: "buffer", createdAt: now, pinned: false, buffer: true },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.classifyBuffer("1", "discard");
      });

      expect(result.current.notes).toHaveLength(0);
    });

    it("promptsVisible is true initially", async () => {
      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      expect(result.current.promptsVisible).toBe(true);
    });

    it("auto-expires old buffer notes on mount", async () => {
      const old = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago
      mockStore._setData("notes",[
        { id: "1", text: "old buffer", createdAt: old, pinned: false, buffer: true },
        { id: "2", text: "regular", createdAt: old, pinned: false },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      expect(result.current.notes[0].text).toBe("regular");
    });
  });

  describe("keyboard shortcuts", () => {
    it("tagGroupBoundaries is empty when filtering", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "alpha", createdAt: 1000, pinned: false, tags: ["foo"] },
        { id: "2", text: "beta", createdAt: 1000, pinned: false, tags: ["bar"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(2);
      });

      act(() => {
        result.current.setText("alpha");
      });

      expect(result.current.tagGroupBoundaries).toEqual([]);
    });

    it("tagGroupBoundaries marks each tag group start index", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "a", createdAt: 1000, pinned: false, tags: ["foo"] },
        { id: "2", text: "b", createdAt: 1000, pinned: false, tags: ["bar"] },
        { id: "3", text: "c", createdAt: 1000, pinned: false, tags: ["foo"] },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(3);
      });

      // bar group starts at 0, foo group starts at 1
      expect(result.current.tagGroupBoundaries).toEqual([0, 1]);
    });

    it("tagGroupBoundaries includes untagged section", async () => {
      mockStore._setData("notes",[
        { id: "1", text: "a", createdAt: 1000, pinned: false, tags: ["foo"] },
        { id: "2", text: "b", createdAt: 1000, pinned: false },
      ]);

      const { useNotes } = await import("@/lib/store/use-notes");
      const { result } = renderHook(() => useNotes());

      await vi.waitFor(() => {
        expect(result.current.notes).toHaveLength(2);
      });

      expect(result.current.tagGroupBoundaries).toEqual([0, 1]);
    });
  });
});
