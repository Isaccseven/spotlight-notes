import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import Shell from "@/components/shell";
import NoteInput from "@/components/note-input";
import NoteList from "@/components/note-list";
import TelemetryDashboard from "@/components/telemetry-dashboard";
import ExportPanel from "@/components/export-panel";
import ShellCommandModal from "@/components/shell-command-modal";
import { useNotes } from "@/lib/store/use-notes";
import { useExport } from "@/lib/export/use-export";
import { initTelemetryListeners } from "@/lib/telemetry/listener";

import { useNotifications } from "@/lib/store/use-notifications";
import PendingReminders from "@/components/pending-reminders";

function App() {
  const [showStats, setShowStats] = useState(false);
  const { pending, cancel } = useNotifications();

  useEffect(() => {
    initTelemetryListeners();
    const unlisten = listen("show-stats", () => {
      setShowStats(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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
    togglePin,
    getNoteTtl,
    classifyBuffer,
    promptsVisible,
  } = useNotes();

  const {
    isExportOpen,
    isShellOpen,
    shellOutput,
    exporting,
    setShellCommand,
    toggleExport,
    closeExport,
    toggleShell,
    closeShell,
    exportNotes,
    runShell,
  } = useExport();

  const activeNote =
    focusedIndex !== null ? filteredNotes[focusedIndex] : undefined;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "e" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        toggleExport();
      }
      if (e.key === "r" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        if (activeNote) {
          toggleShell();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleExport, toggleShell, activeNote]);

  return (
    <Shell>
      {showStats ? (
        <TelemetryDashboard onClose={() => setShowStats(false)} />
      ) : (
        <>
          <NoteInput
            text={text}
            inputRef={inputRef}
            onChange={setText}
            onKeyDown={handleInputKeyDown}
            onClear={() => setText("")}
          />

          <PendingReminders reminders={pending} onCancel={cancel} />

          <NoteList
            notes={filteredNotes}
            query={text.trim()}
            focusedIndex={focusedIndex}
            noteRefs={noteRefs}
            onKeyDown={handleNoteKeyDown}
            onDelete={deleteNote}
            onTogglePin={togglePin}
            getNoteTtl={getNoteTtl}
            classifyBuffer={classifyBuffer}
            promptsVisible={promptsVisible}
          />

          <ExportPanel
            notes={filteredNotes}
            open={isExportOpen}
            exporting={exporting}
            onExport={(format) => exportNotes(filteredNotes, format)}
            onClose={closeExport}
          />

          <ShellCommandModal
            open={isShellOpen}
            output={shellOutput}
            onClose={closeShell}
            onChange={setShellCommand}
            onRun={() => {
              if (activeNote) {
                runShell(activeNote);
              }
            }}
          />
        </>
      )}
    </Shell>
  );
}

export default App;
