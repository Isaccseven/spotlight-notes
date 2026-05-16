import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import { startShortcutSession, clearSession } from "@/lib/telemetry/session";

import { useNotifications } from "@/lib/store/use-notifications";
import PendingReminders from "@/components/pending-reminders";
import { useAutoRouter, registerRoute, openIssueAction } from "@/lib/router";

const APP_WINDOW = getCurrentWindow();

function App() {
  const [showStats, setShowStats] = useState(false);
  const { pending, cancel } = useNotifications();

  useEffect(() => {
    initTelemetryListeners();
    const unlistenStats = listen("show-stats", () => {
      setShowStats(true);
    });

    const unregisterIssueRoute = registerRoute({
      id: "open-issue",
      name: "Open GitHub Issue",
      conditions: [{ type: "hasToken", tokenType: "issue" }],
      action: openIssueAction(),
      enabled: true,
    });

    return () => {
      unlistenStats.then((fn) => fn());
      unregisterIssueRoute();
    };
  }, []);

  useAutoRouter();

  const {
    text,
    setText,
    filteredNotes,
    focusedIndex,
    inputRef,
    noteRefs,
    focusInput,
    submit,
    focus,
    deleteNote,
    togglePin,
    getNoteTtl,
    classifyBuffer,
    promptsVisible,
    intentSuggestion,
    dismissIntent,
    acceptIntent,
    tagGroupBoundaries,
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

  // Keep latest state in a ref so the shortcut listener always sees current
  // values without needing to re-subscribe on every state change.
  const stateRef = useRef({
    text,
    focusedIndex,
    filteredNotes,
    activeNote,
    isExportOpen,
    isShellOpen,
    showStats,
    tagGroupBoundaries,
    intentSuggestion,
  });

  useEffect(() => {
    stateRef.current = {
      text,
      focusedIndex,
      filteredNotes,
      activeNote,
      isExportOpen,
      isShellOpen,
      showStats,
      tagGroupBoundaries,
      intentSuggestion,
    };
  });

  useEffect(() => {
    const unlisten = listen("shortcut-triggered", (event) => {
      const action = event.payload as string;
      const s = stateRef.current;

      switch (action) {
        case "toggle_app": {
          // Window toggle is already handled in Rust, but we still need
          // to manage telemetry session state on the frontend.
          APP_WINDOW.isVisible().then((visible) => {
            if (visible) {
              clearSession();
            } else {
              startShortcutSession();
            }
          });
          break;
        }

        case "toggle_export": {
          toggleExport();
          break;
        }

        case "toggle_shell": {
          if (s.activeNote) {
            toggleShell();
          }
          break;
        }

        case "dismiss_modal": {
          if (s.isShellOpen) {
            closeShell();
          } else if (s.isExportOpen) {
            closeExport();
          } else if (s.showStats) {
            setShowStats(false);
          } else if (s.text) {
            setText("");
            dismissIntent();
          } else {
            APP_WINDOW.hide();
            clearSession();
          }
          break;
        }

        case "save_note": {
          if (s.isShellOpen) {
            if (s.activeNote) {
              runShell(s.activeNote);
            }
          } else {
            if (s.intentSuggestion && !s.text) {
              const accepted = acceptIntent?.() ?? null;
              if (accepted) setText(accepted);
            } else {
              submit();
            }
          }
          break;
        }

        case "focus_first_note": {
          if (s.filteredNotes.length > 0) {
            focus(0);
          }
          break;
        }

        case "clear_or_hide": {
          if (s.text) {
            setText("");
            dismissIntent();
          } else {
            APP_WINDOW.hide();
            clearSession();
          }
          break;
        }

        case "insert_tag": {
          const current = s.text;
          if (!current.endsWith(" ") && !current.endsWith("#")) {
            setText(current + " #");
          } else if (current.endsWith(" ")) {
            setText(current + "#");
          }
          break;
        }

        case "toggle_pin": {
          if (s.focusedIndex !== null && s.filteredNotes[s.focusedIndex]) {
            togglePin(s.filteredNotes[s.focusedIndex].id);
          }
          break;
        }

        case "next_tag_group": {
          if (s.focusedIndex !== null) {
            const next = s.tagGroupBoundaries.find((b) => b > s.focusedIndex!);
            if (next !== undefined) {
              focus(next);
            }
          }
          break;
        }

        case "prev_tag_group": {
          if (s.focusedIndex !== null) {
            const prev = [...s.tagGroupBoundaries]
              .reverse()
              .find((b) => b < s.focusedIndex!);
            if (prev !== undefined) {
              focus(prev);
            }
          }
          break;
        }

        case "focus_next_note": {
          if (s.focusedIndex !== null) {
            if (s.focusedIndex < s.filteredNotes.length - 1) {
              focus(s.focusedIndex + 1);
            } else {
              focusInput();
            }
          }
          break;
        }

        case "focus_prev_note": {
          if (s.focusedIndex !== null) {
            if (s.focusedIndex > 0) {
              focus(s.focusedIndex - 1);
            } else {
              focusInput();
            }
          }
          break;
        }

        case "delete_note": {
          if (s.focusedIndex !== null && s.filteredNotes[s.focusedIndex]) {
            const note = s.filteredNotes[s.focusedIndex];
            const nextFiltered = s.filteredNotes.filter((n) => n.id !== note.id);
            deleteNote(note.id);
            if (nextFiltered.length === 0) {
              focusInput();
            } else {
              focus(Math.min(s.focusedIndex, nextFiltered.length - 1));
            }
          }
          break;
        }

        case "focus_input": {
          focusInput();
          break;
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [
    toggleExport,
    toggleShell,
    closeShell,
    closeExport,
    setText,
    dismissIntent,
    focusInput,
    deleteNote,
    togglePin,
    runShell,
    submit,
    focus,
    acceptIntent,
  ]);

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
            onClear={() => {
              setText("");
              dismissIntent();
            }}
            suggestion={intentSuggestion}
          />

          <PendingReminders reminders={pending} onCancel={cancel} />

          <NoteList
            notes={filteredNotes}
            query={text.trim()}
            focusedIndex={focusedIndex}
            noteRefs={noteRefs}
            onDelete={deleteNote}
            onTogglePin={togglePin}
            getNoteTtl={getNoteTtl}
            classifyBuffer={classifyBuffer}
            promptsVisible={promptsVisible}
            onTagClick={(tag) => setText(`#${tag}`)}
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
