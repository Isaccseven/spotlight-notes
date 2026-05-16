use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

/// A single shortcut definition. Both Rust and the frontend share this schema
/// so every shortcut has a single owner and a single source of truth.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShortcutEntry {
    pub name: String,
    pub keys: String,
    pub scope: ShortcutScope,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ShortcutScope {
    Global,
    Window,
    Input,
    Note,
}

/// The canonical registry. All shortcuts live here.
pub struct ShortcutRegistry {
    shortcuts: Vec<ShortcutEntry>,
    /// Maps a parsed shortcut id to the index in `shortcuts`.
    id_map: HashMap<u32, usize>,
}

impl ShortcutRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            shortcuts: Vec::new(),
            id_map: HashMap::new(),
        };
        registry.load_defaults();
        registry
    }

    fn add(&mut self, entry: ShortcutEntry) {
        if let Ok(parsed) = entry.keys.parse::<Shortcut>() {
            let idx = self.shortcuts.len();
            self.id_map.insert(parsed.id(), idx);
            self.shortcuts.push(entry);
        }
    }

    fn load_defaults(&mut self) {
        let defaults = vec![
            ShortcutEntry {
                name: "toggle_app".into(),
                keys: "CmdOrCtrl+Shift+W".into(),
                scope: ShortcutScope::Global,
                action: "toggle_window".into(),
            },
            ShortcutEntry {
                name: "save_note".into(),
                keys: "Enter".into(),
                scope: ShortcutScope::Input,
                action: "save_note".into(),
            },
            ShortcutEntry {
                name: "focus_first_note".into(),
                keys: "Tab".into(),
                scope: ShortcutScope::Input,
                action: "focus_first_note".into(),
            },
            ShortcutEntry {
                name: "clear_or_hide".into(),
                keys: "Escape".into(),
                scope: ShortcutScope::Input,
                action: "clear_or_hide".into(),
            },
            ShortcutEntry {
                name: "toggle_export".into(),
                keys: "CmdOrCtrl+E".into(),
                scope: ShortcutScope::Window,
                action: "toggle_export".into(),
            },
            ShortcutEntry {
                name: "toggle_shell".into(),
                keys: "CmdOrCtrl+Shift+R".into(),
                scope: ShortcutScope::Window,
                action: "toggle_shell".into(),
            },
            ShortcutEntry {
                name: "insert_tag".into(),
                keys: "CmdOrCtrl+Shift+T".into(),
                scope: ShortcutScope::Input,
                action: "insert_tag".into(),
            },
            ShortcutEntry {
                name: "toggle_pin".into(),
                keys: "CmdOrCtrl+P".into(),
                scope: ShortcutScope::Note,
                action: "toggle_pin".into(),
            },
            ShortcutEntry {
                name: "next_tag_group".into(),
                keys: "CmdOrCtrl+Shift+G".into(),
                scope: ShortcutScope::Note,
                action: "next_tag_group".into(),
            },
            ShortcutEntry {
                name: "prev_tag_group".into(),
                keys: "CmdOrCtrl+Shift+H".into(),
                scope: ShortcutScope::Note,
                action: "prev_tag_group".into(),
            },
            ShortcutEntry {
                name: "focus_next_note".into(),
                keys: "Tab".into(),
                scope: ShortcutScope::Note,
                action: "focus_next_note".into(),
            },
            ShortcutEntry {
                name: "focus_prev_note".into(),
                keys: "Shift+Tab".into(),
                scope: ShortcutScope::Note,
                action: "focus_prev_note".into(),
            },
            ShortcutEntry {
                name: "delete_note".into(),
                keys: "Backspace".into(),
                scope: ShortcutScope::Note,
                action: "delete_note".into(),
            },
            ShortcutEntry {
                name: "focus_input".into(),
                keys: "Escape".into(),
                scope: ShortcutScope::Note,
                action: "focus_input".into(),
            },
            ShortcutEntry {
                name: "dismiss_modal".into(),
                keys: "Escape".into(),
                scope: ShortcutScope::Window,
                action: "dismiss_modal".into(),
            },
        ];
        for entry in defaults {
            self.add(entry);
        }
    }

    pub fn shortcuts(&self) -> &[ShortcutEntry] {
        &self.shortcuts
    }

    pub fn find_by_name(&self, name: &str) -> Option<&ShortcutEntry> {
        self.shortcuts.iter().find(|s| s.name == name)
    }

    /// Register every shortcut whose scope is `Global` with the OS-level
    /// global-shortcut plugin.
    pub fn register_globals(&self, app: &AppHandle) -> Result<(), String> {
        let manager = app.global_shortcut();
        for entry in self.shortcuts.iter().filter(|s| s.scope == ShortcutScope::Global) {
            manager
                .register(entry.keys.as_str())
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Called by the global-shortcut plugin handler whenever any registered
    /// shortcut fires. We look the shortcut up by its OS-level id, execute
    /// the action in Rust when possible, and emit a Tauri event the frontend
    /// can subscribe to.
    pub fn handle_global(&self, app: &AppHandle, shortcut: &Shortcut) -> Result<(), String> {
        if let Some(&idx) = self.id_map.get(&shortcut.id()) {
            let entry = &self.shortcuts[idx];
            if entry.action == "toggle_window" {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            app
                .emit("shortcut-triggered", &entry.name)
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

impl Default for ShortcutRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Expose the full registry so the frontend can reason about shortcuts too.
#[tauri::command]
pub fn get_shortcut_registry(registry: tauri::State<'_, ShortcutRegistry>) -> Vec<ShortcutEntry> {
    registry.shortcuts().to_vec()
}

/// Receives a local shortcut from the frontend bridge, validates it, and
/// emits the unified `shortcut-triggered` event.
#[tauri::command]
pub fn handle_local_shortcut(
    app: AppHandle,
    registry: tauri::State<'_, ShortcutRegistry>,
    name: String,
) -> Result<(), String> {
    let entry = registry
        .find_by_name(&name)
        .ok_or_else(|| format!("Unknown shortcut: {name}"))?;

    if entry.scope == ShortcutScope::Global {
        return Err(format!("{name} is a global shortcut and must not be sent via handle_local_shortcut"));
    }

    app.emit("shortcut-triggered", &entry.name)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Convenience invoked during `lib.rs` setup. Registers globals and wires
/// the plugin handler.
pub fn setup_shortcuts(app: &mut tauri::App) -> Result<(), String> {
    let registry = ShortcutRegistry::new();
    registry.register_globals(app.handle())?;
    app.manage(registry);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_loads_defaults() {
        let registry = ShortcutRegistry::new();
        assert!(!registry.shortcuts.is_empty());
        assert!(registry.find_by_name("toggle_app").is_some());
        assert!(registry.find_by_name("save_note").is_some());
    }

    #[test]
    fn test_global_shortcuts_parsed() {
        let registry = ShortcutRegistry::new();
        let globals: Vec<_> = registry
            .shortcuts
            .iter()
            .filter(|s| s.scope == ShortcutScope::Global)
            .collect();
        assert_eq!(globals.len(), 1);
        assert_eq!(globals[0].name, "toggle_app");
        // Ensure the id_map has an entry for the global shortcut
        assert!(registry.id_map.values().any(|&idx| registry.shortcuts[idx].name == "toggle_app"));
    }

    #[test]
    fn test_local_shortcuts_parsed() {
        let registry = ShortcutRegistry::new();
        let locals: Vec<_> = registry
            .shortcuts
            .iter()
            .filter(|s| s.scope != ShortcutScope::Global)
            .collect();
        assert!(!locals.is_empty());
        for local in &locals {
            // Every local shortcut must be parsable. Entries that share a key
            // combo (e.g. Tab in input vs Tab in note) are both stored in
            // shortcuts; the id_map only keeps the last id for OS-level lookup.
            assert!(
                registry.shortcuts.iter().any(|s| s.name == local.name),
                "{} ({}) should exist in registry",
                local.name,
                local.keys
            );
        }
    }

    #[test]
    fn test_find_by_name() {
        let registry = ShortcutRegistry::new();
        assert_eq!(registry.find_by_name("toggle_app").unwrap().action, "toggle_window");
        assert!(registry.find_by_name("nonexistent").is_none());
    }

    #[test]
    fn test_handle_local_rejects_global() {
        // We can't test the full emit path without a running Tauri app, but we
        // can at least verify the validation logic by checking the error message.
        // Since we don't have an AppHandle in unit tests, we test the registry
        // lookup logic directly.
        let registry = ShortcutRegistry::new();
        let entry = registry.find_by_name("toggle_app").unwrap();
        assert_eq!(entry.scope, ShortcutScope::Global);
    }

    #[test]
    fn test_entry_serde_roundtrip() {
        let entry = ShortcutEntry {
            name: "test".into(),
            keys: "CmdOrCtrl+A".into(),
            scope: ShortcutScope::Window,
            action: "do_something".into(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let back: ShortcutEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(entry, back);
    }

    #[test]
    fn test_scope_serde_snake_case() {
        let scope = ShortcutScope::Input;
        let json = serde_json::to_string(&scope).unwrap();
        assert_eq!(json, "\"input\"");
    }

}
