import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NoteText from "@/components/note-text";

describe("NoteText", () => {
  it("renders plain text without @", () => {
    render(<NoteText text="hello world" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("highlights delay pattern in different color", () => {
    const { container } = render(<NoteText text="remind me @10s" />);
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBeGreaterThanOrEqual(2);

    const delaySpan = Array.from(spans).find((s) => s.textContent === "@10s");
    expect(delaySpan).toBeTruthy();
    expect(delaySpan).toHaveStyle({ color: "#f07167" });
  });

  it("handles multiple delay patterns", () => {
    const { container } = render(<NoteText text="@1m and @2h" />);
    const spans = container.querySelectorAll("span");
    const delaySpans = Array.from(spans).filter(
      (s) => s.style.color === "rgb(240, 113, 103)",
    );
    expect(delaySpans).toHaveLength(2);
  });

  it("renders empty string", () => {
    const { container } = render(<NoteText text="" />);
    expect(container.textContent).toBe("");
  });
});
