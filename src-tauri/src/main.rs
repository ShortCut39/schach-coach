// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux: Grafikbeschleunigung der WebView mit automatischem Rückfall (siehe render.rs)
    #[cfg(target_os = "linux")]
    schach_coach_lib::configure_rendering();

    schach_coach_lib::run();
}
