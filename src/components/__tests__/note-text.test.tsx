import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NoteText from "@/components/note-text";

vi.mock("@/lib/theme/context", () => ({
  useTheme: () => ({ isDark: true }),
}));

describe("NoteText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders plain text without tokens", () => {
    render(<NoteText text="hello world" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("highlights @time tokens in red", () => {
    const { container } = render(<NoteText text="remind me @10s" />);
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBeGreaterThanOrEqual(2);

    const delaySpan = Array.from(spans).find((s) => s.textContent === "@10s");
    expect(delaySpan).toBeTruthy();
    expect(delaySpan).toHaveStyle({ color: "#f07167" });
  });

  it("handles multiple @time tokens", () => {
    const { container } = render(<NoteText text="@1m and @2h" />);
    const spans = container.querySelectorAll("span");
    const delaySpans = Array.from(spans).filter(
      (s) => s.style.color === "rgb(240, 113, 103)",
    );
    expect(delaySpans).toHaveLength(2);
  });

  it("highlights #tags in green", () => {
    const { container } = render(<NoteText text="hello #world" />);
    const tagSpan = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "#world",
    );
    expect(tagSpan).toBeTruthy();
    expect(tagSpan).toHaveStyle({ color: "#7ee787" });
  });

  it("highlights @issue tokens in blue", () => {
    const { container } = render(<NoteText text="fix @issue-123" />);
    const issueSpan = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "@issue-123",
    );
    expect(issueSpan).toBeTruthy();
    expect(issueSpan).toHaveStyle({ color: "#79c0ff" });
  });

  it("highlights @channel tokens in purple", () => {
    const { container } = render(<NoteText text="ask @channel/dev" />);
    const channelSpan = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "@channel/dev",
    );
    expect(channelSpan).toBeTruthy();
    expect(channelSpan).toHaveStyle({ color: "#d2a8ff" });
  });

  it("renders empty string", () => {
    const { container } = render(<NoteText text="" />);
    expect(container.textContent).toBe("");
  });
});
