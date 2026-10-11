mod appearance;
mod import_file;
mod library;
mod lichess;
#[cfg(target_os = "linux")]
mod render;
mod secrets;
mod sound;

/// Linux: WebKitGTK-Darstellung festlegen, bevor Tauri startet (siehe `render.rs`).
#[cfg(target_os = "linux")]
pub fn configure_rendering() {
    render::configure();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Start gilt nach einer Weile als gelungen: Marke für den Absturz-Rückfall entfernen
            #[cfg(target_os = "linux")]
            std::thread::spawn(|| {
                std::thread::sleep(render::STARTUP_GRACE);
                render::mark_started();
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_file::read_import_file,
            import_file::write_export_file,
            library::library_list,
            library::library_get,
            library::library_save,
            library::library_delete,
            secrets::api_key_available,
            secrets::api_key_get,
            secrets::api_key_set,
            secrets::lichess_token_get,
            secrets::lichess_token_set,
            lichess::lichess_oauth_listen,
            lichess::lichess_oauth_cancel,
            lichess::lichess_open,
            sound::sound_register,
            sound::sound_register_file,
            sound::sound_probe,
            sound::sound_play,
            appearance::appearance_list,
            appearance::appearance_read,
            appearance::appearance_write,
            appearance::appearance_remove_file,
            appearance::appearance_delete,
            appearance::appearance_read_dropped,
            appearance::appearance_open_source
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // Normal beendet (auch kurz nach dem Start): kein Absturz
            #[cfg(target_os = "linux")]
            if let tauri::RunEvent::Exit = event {
                render::mark_started();
            }
            #[cfg(not(target_os = "linux"))]
            let _ = event;
        });
}
