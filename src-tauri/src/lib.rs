mod tray;
mod window;
mod notifications;

#[cfg(test)]
mod tests {
    #[test]
    fn test_modules_compile() {
        // Verifies that all backend modules compile correctly.
        let _ = crate::notifications::parse_delay_ms;
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            tray::setup_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![notifications::register_notification])
        .on_window_event(window::on_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
