import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TelemetryDashboard from "@/components/telemetry-dashboard";

const refreshMock = vi.fn();

vi.mock("@/lib/telemetry/use-telemetry", () => ({
  useTelemetry: () => ({
    events: [],
    loading: false,
    refresh: refreshMock,
    daily: {
      date: "2026-05-15",
      shortcutTriggers: 1,
      captures: 2,
      avgCaptureMs: 300,
      remindersScheduled: 0,
      remindersFired: 0,
      sessions: 1,
    },
    weekly: {
      startDate: "2026-05-09",
      endDate: "2026-05-15",
      shortcutTriggers: 3,
      captures: 5,
      avgCaptureMs: 350,
      remindersScheduled: 1,
      remindersFired: 1,
      sessions: 2,
      repeatCaptureRate: 50,
      reminderCompletionRate: 100,
    },
    totalCaptures: 10,
    totalShortcuts: 8,
  }),
}));

describe("TelemetryDashboard", () => {
  it("renders dashboard with stats", () => {
    render(<TelemetryDashboard onClose={vi.fn()} />);

    expect(screen.getByText("Your Stats")).toBeInTheDocument();
    expect(screen.getByText("Total Captures")).toBeInTheDocument();
    expect(screen.getByText("Total Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Week (2026-05-09 – 2026-05-15)")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<TelemetryDashboard onClose={onClose} />);

    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls refresh when refresh button is clicked", () => {
    render(<TelemetryDashboard onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Refresh"));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
