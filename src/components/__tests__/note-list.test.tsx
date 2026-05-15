import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NoteList from "@/components/note-list";

describe("NoteList", () => {
  const notes = [
    { id: "1", text: "first note" },
    { id: "2", text: "second note" },
    { id: "3", text: "third note" },
  ];

  it("renders nothing when notes array is empty", () => {
    const { container } = render(
      <NoteList
        notes={[]}
        focusedIndex={null}
        noteRefs={{ current: [] }}
        onKeyDown={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all notes", () => {
    render(
      <NoteList
        notes={notes}
        focusedIndex={null}
        noteRefs={{ current: [] }}
        onKeyDown={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("first note")).toBeInTheDocument();
    expect(screen.getByText("second note")).toBeInTheDocument();
    expect(screen.getByText("third note")).toBeInTheDocument();
  });

  it("applies focus style to focused note", () => {
    const { container } = render(
      <NoteList
        notes={notes}
        focusedIndex={1}
        noteRefs={{ current: [] }}
        onKeyDown={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const rows = container.querySelectorAll("[tabIndex='-1']");
    expect(rows[1]).toHaveClass("bg-white/8");
    expect(rows[0]).not.toHaveClass("bg-white/8");
    expect(rows[2]).not.toHaveClass("bg-white/8");
  });

  it("calls onDelete with note id when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <NoteList
        notes={notes}
        focusedIndex={null}
        noteRefs={{ current: [] }}
        onKeyDown={vi.fn()}
        onDelete={onDelete}
      />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onDelete).toHaveBeenCalledWith("2");
  });

  it("calls onKeyDown with index on keydown", () => {
    const onKeyDown = vi.fn();
    const { container } = render(
      <NoteList
        notes={notes}
        focusedIndex={null}
        noteRefs={{ current: [] }}
        onKeyDown={onKeyDown}
        onDelete={vi.fn()}
      />,
    );
    const rows = container.querySelectorAll("[tabIndex='-1']");
    fireEvent.keyDown(rows[2], { key: "Backspace" });
    expect(onKeyDown).toHaveBeenCalledWith(expect.anything(), 2);
  });
});
