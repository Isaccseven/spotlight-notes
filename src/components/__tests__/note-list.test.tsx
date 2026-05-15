import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NoteList from "@/components/note-list";

describe("NoteList", () => {
  const notes = [
    { id: "1", text: "first note", createdAt: 1000, pinned: false },
    { id: "2", text: "second note", createdAt: 2000, pinned: false },
    { id: "3", text: "third note", createdAt: 3000, pinned: false },
  ];

  const getNoteTtl = vi.fn(() => "12h");
  const onTogglePin = vi.fn();
  const classifyBuffer = vi.fn();

  const defaultProps = {
    focusedIndex: null as number | null,
    noteRefs: { current: [] } as React.MutableRefObject<(HTMLDivElement | null)[]>,
    onKeyDown: vi.fn(),
    onDelete: vi.fn(),
    onTogglePin,
    getNoteTtl,
    classifyBuffer,
    promptsVisible: true,
  };

  it("renders nothing when notes array is empty", () => {
    const { container } = render(
      <NoteList notes={[]} {...defaultProps} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all notes", () => {
    render(<NoteList notes={notes} {...defaultProps} />);
    expect(screen.getByText("first note")).toBeInTheDocument();
    expect(screen.getByText("second note")).toBeInTheDocument();
    expect(screen.getByText("third note")).toBeInTheDocument();
  });

  it("applies focus style to focused note", () => {
    const { container } = render(
      <NoteList notes={notes} {...defaultProps} focusedIndex={1} />,
    );
    const rows = container.querySelectorAll("[tabIndex='-1']");
    expect(rows[1]).toHaveClass("bg-white/8");
    expect(rows[0]).not.toHaveClass("bg-white/8");
    expect(rows[2]).not.toHaveClass("bg-white/8");
  });

  it("calls onDelete with note id when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(<NoteList notes={notes} {...defaultProps} onDelete={onDelete} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[3]);
    expect(onDelete).toHaveBeenCalledWith("2");
  });

  it("calls onKeyDown with index on keydown", () => {
    const onKeyDown = vi.fn();
    const { container } = render(
      <NoteList notes={notes} {...defaultProps} onKeyDown={onKeyDown} />,
    );
    const rows = container.querySelectorAll("[tabIndex='-1']");
    fireEvent.keyDown(rows[2], { key: "Backspace" });
    expect(onKeyDown).toHaveBeenCalledWith(expect.anything(), "3", 2, 3);
  });

  it("calls onTogglePin when pin button is clicked", () => {
    const onTogglePinLocal = vi.fn();
    render(
      <NoteList notes={notes} {...defaultProps} onTogglePin={onTogglePinLocal} />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onTogglePinLocal).toHaveBeenCalledWith("1");
  });

  it("displays TTL for unpinned notes", () => {
    render(<NoteList notes={notes} {...defaultProps} />);
    expect(screen.getAllByText("12h").length).toBe(3);
  });

  it("does not display TTL for pinned notes", () => {
    const pinnedNotes = [
      { id: "1", text: "pinned note", createdAt: 1000, pinned: true },
    ];
    const ttlMock = vi.fn(() => null);
    render(
      <NoteList
        notes={pinnedNotes}
        {...defaultProps}
        getNoteTtl={ttlMock}
      />,
    );
    expect(screen.queryByText("12h")).toBeNull();
    expect(ttlMock).toHaveBeenCalledWith(pinnedNotes[0]);
  });

  describe("tag bucketing", () => {
    const taggedNotes = [
      { id: "1", text: "work task", createdAt: 1000, pinned: false, tags: ["work"] },
      { id: "2", text: "personal task", createdAt: 2000, pinned: false, tags: ["personal"] },
      { id: "3", text: "work urgent", createdAt: 3000, pinned: false, tags: ["work", "urgent"] },
      { id: "4", text: "no tags", createdAt: 4000, pinned: false },
    ];

    it("groups notes by tag headers when not filtering", () => {
      render(<NoteList notes={taggedNotes} {...defaultProps} />);
      expect(screen.getByText("#personal")).toBeInTheDocument();
      expect(screen.getByText("#urgent")).toBeInTheDocument();
      expect(screen.getByText("#work")).toBeInTheDocument();
      expect(screen.getByText("Untagged")).toBeInTheDocument();
    });

    it("shows no tag headers for plain-text filter", () => {
      render(<NoteList notes={taggedNotes} {...defaultProps} query="task" />);
      expect(screen.queryByText("#work")).toBeNull();
      expect(screen.queryByText("#personal")).toBeNull();
      expect(screen.getByText("work task")).toBeInTheDocument();
      expect(screen.getByText("personal task")).toBeInTheDocument();
    });

    it("groups by tag and shows summary for tag filter", () => {
      render(
        <NoteList
          notes={[
            { id: "1", text: "work task", createdAt: 1000, pinned: false, tags: ["work"] },
            { id: "3", text: "work urgent", createdAt: 3000, pinned: false, tags: ["work", "urgent"] },
          ]}
          {...defaultProps}
          query="#work"
        />,
      );
      expect(screen.getByText("2 notes matching #work")).toBeInTheDocument();
      expect(screen.getByText("#urgent")).toBeInTheDocument();
      expect(screen.getByText("#work")).toBeInTheDocument();
    });

    it("shows singular summary for one matching note", () => {
      render(
        <NoteList
          notes={[
            { id: "1", text: "work task", createdAt: 1000, pinned: false, tags: ["work"] },
          ]}
          {...defaultProps}
          query="#work"
        />,
      );
      expect(screen.getByText("1 note matching #work")).toBeInTheDocument();
    });

    it("lists untagged notes under Untagged header", () => {
      const untaggedOnly = [
        { id: "4", text: "no tags", createdAt: 4000, pinned: false },
      ];
      render(<NoteList notes={untaggedOnly} {...defaultProps} />);
      expect(screen.getByText("Untagged")).toBeInTheDocument();
      expect(screen.getByText("no tags")).toBeInTheDocument();
    });
  });

  describe("buffer classification", () => {
    it("shows buffer prompt for buffer notes when promptsVisible is true", () => {
      const bufferNotes = [
        { id: "1", text: "buffer note", createdAt: 1000, pinned: false, buffer: true },
      ];
      render(
        <NoteList
          notes={bufferNotes}
          {...defaultProps}
          promptsVisible={true}
        />,
      );
      expect(screen.getByText("Buffer")).toBeInTheDocument();
      expect(screen.getByText("Tag")).toBeInTheDocument();
      expect(screen.getByText("Remind")).toBeInTheDocument();
      expect(screen.getByText("Discard")).toBeInTheDocument();
    });

    it("hides buffer prompt when promptsVisible is false", () => {
      const bufferNotes = [
        { id: "1", text: "buffer note", createdAt: 1000, pinned: false, buffer: true },
      ];
      render(
        <NoteList
          notes={bufferNotes}
          {...defaultProps}
          promptsVisible={false}
        />,
      );
      expect(screen.queryByText("Buffer")).toBeNull();
      expect(screen.queryByText("Tag")).toBeNull();
    });

    it("does not show buffer prompt for non-buffer notes", () => {
      render(<NoteList notes={notes} {...defaultProps} />);
      expect(screen.queryByText("Buffer")).toBeNull();
    });

    it("calls classifyBuffer with 'tag' when Tag is clicked", () => {
      const bufferNotes = [
        { id: "1", text: "buffer note", createdAt: 1000, pinned: false, buffer: true },
      ];
      render(
        <NoteList
          notes={bufferNotes}
          {...defaultProps}
          classifyBuffer={classifyBuffer}
        />,
      );
      fireEvent.click(screen.getByText("Tag"));
      expect(classifyBuffer).toHaveBeenCalledWith("1", "tag");
    });

    it("calls classifyBuffer with 'remind' when Remind is clicked", () => {
      const bufferNotes = [
        { id: "1", text: "buffer note", createdAt: 1000, pinned: false, buffer: true },
      ];
      render(
        <NoteList
          notes={bufferNotes}
          {...defaultProps}
          classifyBuffer={classifyBuffer}
        />,
      );
      fireEvent.click(screen.getByText("Remind"));
      expect(classifyBuffer).toHaveBeenCalledWith("1", "remind");
    });

    it("calls classifyBuffer with 'discard' when Discard is clicked", () => {
      const bufferNotes = [
        { id: "1", text: "buffer note", createdAt: 1000, pinned: false, buffer: true },
      ];
      render(
        <NoteList
          notes={bufferNotes}
          {...defaultProps}
          classifyBuffer={classifyBuffer}
        />,
      );
      fireEvent.click(screen.getByText("Discard"));
      expect(classifyBuffer).toHaveBeenCalledWith("1", "discard");
    });
  });
});
