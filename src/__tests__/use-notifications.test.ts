import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
