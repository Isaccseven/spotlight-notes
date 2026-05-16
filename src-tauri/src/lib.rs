mod tray;
mod window;
mod notifications;
mod export;
mod grammar;
mod shortcuts;

use tauri::Manager;

#[cfg(test)]
mod tests {
    #[test]
    fn test_modules_compile() {
        let _ = crate::grammar::parse_note;
        let _ = crate::notifications::NotificationQueue::new;
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .level(tauri_plugin_log::log::LevelFilter::Debug)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(registry) = app.try_state::<shortcuts::ShortcutRegistry>() {
                            let _ = registry.handle_global(app, shortcut);
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(notifications::NotificationQueue::new())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            tray::setup_tray(app)?;

            if let Err(e) = shortcuts::setup_shortcuts(app) {
                tauri_plugin_log::log::warn!("Failed to setup shortcuts: {e}");
            }

            if let Err(e) = app.state::<notifications::NotificationQueue>().restore(app.handle().clone()) {
                tauri_plugin_log::log::warn!("Failed to restore notification queue: {e}");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notifications::register_notification,
            notifications::cancel_notification,
            notifications::list_pending_notifications,
            grammar::parse_note_command,
            export::write_export_files,
            export::run_shell_command,
            tray::refresh_tray,
            shortcuts::get_shortcut_registry,
            shortcuts::handle_local_shortcut,
        ])
        .on_window_event(window::on_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
