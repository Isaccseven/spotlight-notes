import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PendingReminders from "@/components/pending-reminders";
import { ScheduledNotification } from "@/types/notification";

describe("PendingReminders", () => {
  it("renders nothing when there are no reminders", () => {
    const { container } = render(
      <PendingReminders reminders={[]} onCancel={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders reminder body and scheduled time", () => {
    const reminders: ScheduledNotification[] = [
      {
        id: "1",
        body: "Buy milk",
        trigger_at: new Date("2026-01-01T12:00:00").getTime(),
        created_at: 0,
      },
    ];

    render(<PendingReminders reminders={reminders} onCancel={vi.fn()} />);

    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
  });

  it("renders multiple reminders", () => {
    const reminders: ScheduledNotification[] = [
      {
        id: "1",
        body: "First",
        trigger_at: new Date("2026-01-01T10:00:00").getTime(),
        created_at: 0,
      },
      {
        id: "2",
        body: "Second",
        trigger_at: new Date("2026-01-01T11:00:00").getTime(),
        created_at: 0,
      },
    ];

    render(<PendingReminders reminders={reminders} onCancel={vi.fn()} />);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    const reminders: ScheduledNotification[] = [
      {
        id: "1",
        body: "Buy milk",
        trigger_at: new Date("2026-01-01T12:00:00").getTime(),
        created_at: 0,
      },
    ];

    render(
      <PendingReminders reminders={reminders} onCancel={onCancel} />,
    );

    const button = screen.getByRole("button", { name: /cancel reminder/i });
    fireEvent.click(button);

    expect(onCancel).toHaveBeenCalledWith("1");
  });
});
