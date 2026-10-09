// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK stürzt unter Wayland mit NVIDIA-Treibern ab
    // ("Error 71 (Protokollfehler) dispatching to Wayland display").
    // Der DMABUF-Renderer wird deshalb abgeschaltet, sofern der Nutzer nichts anderes gesetzt hat.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // SAFETY: Läuft vor dem Start weiterer Threads.
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }

    schach_coach_lib::run();
}
