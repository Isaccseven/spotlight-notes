import "./App.css";
import Shell from "@/components/shell";
import NoteInput from "@/components/note-input";
import NoteList from "@/components/note-list";
import { useNotes } from "@/lib/store/use-notes";

function App() {
  const {
    text,
    setText,
    filteredNotes,
    focusedIndex,
    inputRef,
    noteRefs,
    handleInputKeyDown,
    handleNoteKeyDown,
    deleteNote,
  } = useNotes();

  return (
    <Shell>
      <NoteInput
        text={text}
        inputRef={inputRef}
        onChange={setText}
        onKeyDown={handleInputKeyDown}
        onClear={() => setText("")}
      />

      <NoteList
        notes={filteredNotes}
        focusedIndex={focusedIndex}
        noteRefs={noteRefs}
        onKeyDown={handleNoteKeyDown}
        onDelete={deleteNote}
      />
    </Shell>
  );
}

export default App;
