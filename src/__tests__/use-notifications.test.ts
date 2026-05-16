import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { emitTestEvent, clearTestEventListeners } from "./setup";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestEventListeners();
  });

  it("loads pending notifications on mount", async () => {
    const pending = [
      { id: "1", body: "test", trigger_at: 1000, created_at: 0 },
    ];
    mockInvoke.mockResolvedValue(pending);

    const { useNotifications } = await import(
      "@/lib/store/use-notifications"
    );
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.pending).toEqual(pending);
    });
  });

  it("starts with empty pending list", async () => {
    mockInvoke.mockResolvedValue([]);

    const { useNotifications } = await import(
      "@/lib/store/use-notifications"
    );
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.pending).toEqual([]);
    });
  });

  it("cancel invokes cancel_notification and refreshes", async () => {
    mockInvoke.mockResolvedValue([]);

    const { useNotifications } = await import(
      "@/lib/store/use-notifications"
    );
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.pending).toEqual([]);
    });

    await act(async () => {
      await result.current.cancel("1");
    });

    expect(mockInvoke).toHaveBeenCalledWith("cancel_notification", { id: "1" });
  });

  it("polls pending notifications every 5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockInvoke.mockResolvedValue([]);

    const { useNotifications } = await import(
      "@/lib/store/use-notifications"
    );
    renderHook(() => useNotifications());

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_pending_notifications");
    });

    const initialCalls = mockInvoke.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockInvoke.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    vi.useRealTimers();
  }, 10000);

  it("adds a pending notification when reminder_scheduled event fires", async () => {
    mockInvoke.mockResolvedValue([]);

    const { useNotifications } = await import(
      "@/lib/store/use-notifications"
    );
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.pending).toEqual([]);
    });

    const scheduled = { id: "2", body: "new reminder", trigger_at: 5000, created_at: 0 };
    act(() => {
      emitTestEvent("reminder_scheduled", scheduled);
    });

    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pending[0]).toEqual(scheduled);
  });

  it("refreshes pending list when reminder_fired event fires", async () => {
    mockInvoke.mockResolvedValue([]);

    const { useNotifications } = await import(
      "@/lib/store/use-notifications"
    );
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.pending).toEqual([]);
    });

    act(() => {
      emitTestEvent("reminder_fired", "some-id");
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_pending_notifications");
    });
  });
});
