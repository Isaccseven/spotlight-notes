import { invoke } from "@tauri-apps/api/core";
import type { ShortcutEntry, ShortcutScope } from "./types";

let registry: ShortcutEntry[] | null = null;

function isMac(): boolean {
  return navigator.platform.toLowerCase().includes("mac");
}

function getScope(): ShortcutScope {
  const active = document.activeElement;
  if (!active) return "window";
  if (active.closest("[data-note-index]")) return "note";
  if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return "input";
  return "window";
}

function isModalOpen(): boolean {
  return !!document.querySelector("[data-modal]");
}

function matchesKeys(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split("+");
  const keyPart = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));

  const mac = isMac();

  // Required modifiers
  if (mods.has("CmdOrCtrl")) {
    if (mac && !e.metaKey) return false;
    if (!mac && !e.ctrlKey) return false;
  } else {
    if (mods.has("Cmd") && !e.metaKey) return false;
    if (mods.has("Ctrl") && !e.ctrlKey) return false;
  }
  if (mods.has("Shift") && !e.shiftKey) return false;
  if (mods.has("Alt") && !e.altKey) return false;

  // Forbidden modifiers (strict matching)
  const requiredMeta = mods.has("Cmd") || (mods.has("CmdOrCtrl") && mac);
  const requiredCtrl = mods.has("Ctrl") || (mods.has("CmdOrCtrl") && !mac);
  const requiredShift = mods.has("Shift");
  const requiredAlt = mods.has("Alt");

  if (!requiredMeta && e.metaKey) return false;
  if (!requiredCtrl && e.ctrlKey) return false;
  if (!requiredShift && e.shiftKey) return false;
  if (!requiredAlt && e.altKey) return false;

  // Key match
  const eventKey = e.key;
  const matchKey = keyPart.length === 1 ? keyPart.toLowerCase() : keyPart;

  return (
    eventKey === matchKey || eventKey.toLowerCase() === matchKey.toLowerCase()
  );
}

function findMatchingShortcut(e: KeyboardEvent): ShortcutEntry | null {
  if (!registry) return null;
  const scope = getScope();
  const modalOpen = isModalOpen();

  for (const shortcut of registry) {
    if (shortcut.scope === "global") continue;
    if (!matchesKeys(e, shortcut.keys)) continue;

    // In a modal, only Enter and Escape are shortcut candidates
    if (modalOpen && shortcut.keys !== "Enter" && shortcut.keys !== "Escape") {
      continue;
    }

    // In a modal, Escape always maps to dismiss_modal
    if (modalOpen && e.key === "Escape" && shortcut.name !== "dismiss_modal") {
      continue;
    }

    if (shortcut.scope === scope || shortcut.scope === "window") {
      return shortcut;
    }
  }

  return null;
}

export async function initShortcutBridge(): Promise<void> {
  try {
    registry = await invoke<ShortcutEntry[]>("get_shortcut_registry");
  } catch (e) {
    console.error("Failed to load shortcut registry:", e);
    return;
  }

  document.addEventListener("keydown", (e) => {
    const shortcut = findMatchingShortcut(e);
    if (!shortcut) return;

    e.preventDefault();
    invoke("handle_local_shortcut", { name: shortcut.name }).catch((err) => {
      console.error("Shortcut handler error:", err);
    });
  });
}
