use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};

const TRAY_ID: &str = "main-tray";
const STORE_PATH: &str = "notes.json";
const STORAGE_KEY: &str = "notes";
const MAX_RECENT_NOTES: usize = 5;

#[derive(Default)]
pub struct TrayState {
    pub notifications_muted: AtomicBool,
    pub dark_theme: AtomicBool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Note {
    id: String,
    text: String,
}

fn format_note_preview(text: &str) -> String {
    let preview = text.trim().replace('\n', " ");
    let char_count = preview.chars().count();
    if char_count > 40 {
        let truncated: String = preview.chars().take(40).collect();
        format!("{}…", truncated)
    } else {
        preview
    }
}

fn fetch_notes(app: &tauri::AppHandle) -> Vec<Note> {
    use tauri_plugin_store::StoreExt;
    let Ok(store) = app.store(STORE_PATH) else {
        return Vec::new();
    };
    let Some(value) = store.get(STORAGE_KEY) else {
        return Vec::new();
    };
    serde_json::from_value(value).unwrap_or_default()
}

fn today_count(notes: &[Note]) -> usize {
    notes.len()
}

fn build_tray_menu(
    app: &tauri::AppHandle,
    state: &TrayState,
) -> tauri::Result<Menu<tauri::Wry>> {
    let notes = fetch_notes(app);
    let recent: Vec<_> = notes.iter().take(MAX_RECENT_NOTES).collect();

    let today_label = format!("Today: {} captures", today_count(&notes));
    let today_item = MenuItem::with_id(app, "today", today_label, false, None::<&str>)?;

    let mut recent_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    if recent.is_empty() {
        recent_items.push(MenuItem::with_id(
            app,
            "recent-none",
            "No recent notes",
            false,
            None::<&str>,
        )?);
    } else {
        for note in &recent {
            let id = format!("recent-{}", note.id);
            let text = format_note_preview(&note.text);
            recent_items.push(MenuItem::with_id(app, &id, text, true, None::<&str>)?);
        }
    }
    let recent_refs: Vec<&dyn IsMenuItem<tauri::Wry>> = recent_items
        .iter()
        .map(|i| i as &dyn IsMenuItem<tauri::Wry>)
        .collect();
    let recent_submenu = Submenu::with_items(app, "Recent Notes", true, &recent_refs)?;

    let mute_label = if state.notifications_muted.load(Ordering::Relaxed) {
        "Unmute Notifications"
    } else {
        "Mute Notifications"
    };
    let mute_item = MenuItem::with_id(app, "mute", mute_label, true, None::<&str>)?;

    let theme_label = if state.dark_theme.load(Ordering::Relaxed) {
        "Switch to Light Theme"
    } else {
        "Switch to Dark Theme"
    };
    let theme_item = MenuItem::with_id(app, "theme", theme_label, true, None::<&str>)?;

    let window = app.get_webview_window("main");
    let is_visible = window
        .as_ref()
        .map(|w| w.is_visible().unwrap_or(false))
        .unwrap_or(false);
    let toggle_label = if is_visible {
        "Hide Quick Note"
    } else {
        "Show Quick Note"
    };
    let stats_item = MenuItem::with_id(app, "stats", "Your Stats", true, None::<&str>)?;
    let toggle_item = MenuItem::with_id(app, "toggle", toggle_label, true, None::<&str>)?;

    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &today_item,
            &recent_submenu,
            &PredefinedMenuItem::separator(app)?,
            &mute_item,
            &theme_item,
            &PredefinedMenuItem::separator(app)?,
            &stats_item,
            &toggle_item,
            &quit_item,
        ],
    )?;

    Ok(menu)
}

pub fn update_tray_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    let Some(state) = app.try_state::<TrayState>() else {
        return Ok(());
    };
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };
    let menu = build_tray_menu(app, &state)?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

pub fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    app.manage(TrayState::default());

    let state: tauri::State<TrayState> = app.state();
    let menu = build_tray_menu(app.handle(), &state)?;

    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Spotlight Notes")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or_default() {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                let _ = update_tray_menu(app);
            }
            "mute" => {
                if let Some(state) = app.try_state::<TrayState>() {
                    let current = state.notifications_muted.load(Ordering::Relaxed);
                    state.notifications_muted.store(!current, Ordering::Relaxed);
                    let _ = update_tray_menu(app);
                }
            }
            "theme" => {
                if let Some(state) = app.try_state::<TrayState>() {
                    let current = state.dark_theme.load(Ordering::Relaxed);
                    let new_value = !current;
                    state.dark_theme.store(new_value, Ordering::Relaxed);
                    let _ = app.emit("theme-changed", new_value);
                    let _ = update_tray_menu(app);
                }
            }
            "stats" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit("show-stats", ());
                let _ = update_tray_menu(app);
            }
            "quit" => {
                app.exit(0);
            }
            id => {
                if let Some(note_id) = id.strip_prefix("recent-") {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    let _ = app.emit("open-note", note_id);
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });

    #[cfg(target_os = "macos")]
    let builder = builder.icon_as_template(true).show_menu_on_left_click(false);

    let _ = builder.build(app);

    Ok(())
}

#[tauri::command]
pub async fn refresh_tray(app: tauri::AppHandle) -> Result<(), String> {
    update_tray_menu(&app).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_note_preview_short() {
        assert_eq!(format_note_preview("hello"), "hello");
    }

    #[test]
    fn test_format_note_preview_exact_40() {
        let text = "a".repeat(40);
        assert_eq!(format_note_preview(&text), text);
    }

    #[test]
    fn test_format_note_preview_long() {
        let text = "a".repeat(50);
        let expected = "a".repeat(40) + "…";
        assert_eq!(format_note_preview(&text), expected);
    }

    #[test]
    fn test_format_note_preview_trims_newlines() {
        assert_eq!(format_note_preview("line1\nline2"), "line1 line2");
    }

    #[test]
    fn test_format_note_preview_trims_whitespace() {
        assert_eq!(format_note_preview("  hello  "), "hello");
    }

    #[test]
    fn test_today_count_empty() {
        assert_eq!(today_count(&[]), 0);
    }

    #[test]
    fn test_today_count_some() {
        let notes = vec![
            Note {
                id: "1".to_string(),
                text: "a".to_string(),
            },
            Note {
                id: "2".to_string(),
                text: "b".to_string(),
            },
        ];
        assert_eq!(today_count(&notes), 2);
    }

    #[test]
    fn test_note_deserialization() {
        let json = r#"[{"id":"1","text":"hello"}]"#;
        let notes: Vec<Note> = serde_json::from_str(json).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].id, "1");
        assert_eq!(notes[0].text, "hello");
    }
}
