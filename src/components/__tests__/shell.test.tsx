import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Shell from "@/components/shell";

describe("Shell", () => {
  it("renders children", () => {
    render(
      <Shell>
        <div data-testid="child">Hello</div>
      </Shell>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("has transition classes for visibility", () => {
    const { container } = render(
      <Shell>
        <span>content</span>
      </Shell>,
    );
    const inner = container.querySelector(".bg-\\[\\#1a1a1a\\]\\/90");
    expect(inner).toBeInTheDocument();
  });
});
