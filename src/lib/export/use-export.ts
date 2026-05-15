import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Note } from "@/types/note";
import { formatNotes, ExportFormat } from "./formatters";

export function useExport() {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShellOpen, setIsShellOpen] = useState(false);
  const [shellCommand, setShellCommand] = useState("");
  const [shellOutput, setShellOutput] = useState("");
  const [exporting, setExporting] = useState(false);

  const toggleExport = useCallback(() => {
    setIsExportOpen((prev) => !prev);
    setIsShellOpen(false);
  }, []);

  const closeExport = useCallback(() => {
    setIsExportOpen(false);
  }, []);

  const toggleShell = useCallback(() => {
    setIsShellOpen((prev) => !prev);
    setIsExportOpen(false);
    setShellOutput("");
  }, []);

  const closeShell = useCallback(() => {
    setIsShellOpen(false);
    setShellOutput("");
  }, []);

  const exportNotes = useCallback(async (notes: Note[], format: ExportFormat) => {
    if (notes.length === 0) return;
    setExporting(true);
    try {
      const files = formatNotes(notes, format);
      const dir = await open({
        directory: true,
        title: "Choose export directory",
      });
      if (!dir) return;
      await invoke("write_export_files", { dir, files });
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
      setIsExportOpen(false);
    }
  }, []);

  const runShell = useCallback(async (note: Note) => {
    if (!shellCommand.trim()) return;
    try {
      const output = await invoke<string>("run_shell_command", {
        command: shellCommand,
        input: note.text,
      });
      setShellOutput(output);
    } catch (err) {
      setShellOutput(String(err));
    }
  }, [shellCommand]);

  return {
    isExportOpen,
    isShellOpen,
    shellCommand,
    shellOutput,
    exporting,
    setShellCommand,
    toggleExport,
    closeExport,
    toggleShell,
    closeShell,
    exportNotes,
    runShell,
  };
}
