import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NoteInput from "@/components/note-input";

describe("NoteInput", () => {
  it("renders input with placeholder", () => {
    render(
      <NoteInput
        text=""
        inputRef={{ current: null }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.getByPlaceholderText("Type a quick note..."),
    ).toBeInTheDocument();
  });

  it("displays current text value", () => {
    render(
      <NoteInput
        text="my note"
        inputRef={{ current: null }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const input = screen.getByDisplayValue("my note");
    expect(input).toBeInTheDocument();
  });

  it("calls onChange when typing", () => {
    const onChange = vi.fn();
    render(
      <NoteInput
        text=""
        inputRef={{ current: null }}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Type a quick note...");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("shows clear button when text is non-empty", () => {
    render(
      <NoteInput
        text="hello"
        inputRef={{ current: null }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const clearButton = screen.getByRole("button");
    expect(clearButton).toBeInTheDocument();
  });

  it("hides clear button when text is empty", () => {
    render(
      <NoteInput
        text=""
        inputRef={{ current: null }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    render(
      <NoteInput
        text="hello"
        inputRef={{ current: null }}
        onChange={vi.fn()}
        onClear={onClear}
      />,
    );
    const clearButton = screen.getByRole("button");
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalled();
  });

  it("shows suggestion placeholder when suggestion is present and text is empty", () => {
    render(
      <NoteInput
        text=""
        inputRef={{ current: null }}
        onChange={vi.fn()}
        onClear={vi.fn()}
        suggestion={{ text: " #work", source: "last-tag", label: "continue #work" }}
      />,
    );
    expect(screen.getByPlaceholderText("Tab for continue #work")).toBeInTheDocument();
  });

  it("shows default placeholder when no suggestion is present", () => {
    render(
      <NoteInput
        text=""
        inputRef={{ current: null }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Type a quick note...")).toBeInTheDocument();
  });
});
