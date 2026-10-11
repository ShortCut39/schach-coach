//! Grafikbeschleunigung der WebView unter Linux (WebKitGTK), mit automatischem Rückfall.
//!
//! Früher war der DMABUF-Renderer immer aus: Mit NVIDIA unter Wayland brach WebKitGTK ab
//! („Error 71 (Protokollfehler) dispatching to Wayland display“). Ohne ihn zeichnet aber die CPU
//! jedes Bild, und bei großen Fenstern ruckelt die App. Ursache des Abbruchs ist „explicit sync“
//! im NVIDIA-Treiber; `__NV_DISABLE_EXPLICIT_SYNC=1` umgeht ihn, die GPU bleibt in Benutzung.
//!
//! Sicherheitsnetz: Beim Start liegt eine Marke im App-Datenordner. Läuft die App 15 s lang oder
//! wird sie normal beendet, verschwindet sie. Findet der nächste Start sie noch vor, ist der
//! vorige Start abgestürzt: Dann schaltet die App dauerhaft auf den sicheren Modus (ohne DMABUF)
//! und merkt sich das in `render-safe-mode`. Löschen dieser Datei probiert die GPU erneut.
//! Selbst gesetzte Umgebungsvariablen haben immer Vorrang.

use std::path::PathBuf;
use std::time::Duration;

/// Identifier aus `tauri.conf.json` (Name des App-Datenordners)
const IDENTIFIER: &str = "de.schachcoach.desktop";
const START_MARKER: &str = "render-starting";
const SAFE_MODE: &str = "render-safe-mode";
/// So lange muss ein Start laufen, bis er als gelungen gilt
pub const STARTUP_GRACE: Duration = Duration::from_secs(15);

/// App-Datenordner wie bei Tauri unter Linux (`$XDG_DATA_HOME` bzw. `~/.local/share`)
fn data_dir() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_DATA_HOME")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
        })?;
    Some(base.join(IDENTIFIER))
}

/// Was beim Start zu tun ist (ohne Seiteneffekte, testbar)
#[derive(Debug, PartialEq, Eq)]
pub enum Mode {
    /// Nutzer hat `WEBKIT_DISABLE_DMABUF_RENDERER` selbst gesetzt: nichts ändern
    UserChoice,
    /// GPU-Darstellung (DMABUF an, NVIDIA ohne explicit sync)
    Gpu,
    /// Sicherer Modus: DMABUF aus (CPU zeichnet)
    Safe { newly_detected: bool },
}

pub fn decide(user_set: bool, safe_mode_file: bool, start_marker_left: bool) -> Mode {
    if user_set {
        Mode::UserChoice
    } else if safe_mode_file {
        Mode::Safe {
            newly_detected: false,
        }
    } else if start_marker_left {
        Mode::Safe {
            newly_detected: true,
        }
    } else {
        Mode::Gpu
    }
}

/// Vor dem Start von Tauri aufrufen (setzt Umgebungsvariablen für WebKitGTK).
pub fn configure() {
    let user_set = std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_some();
    let dir = data_dir();
    let exists = |name: &str| dir.as_ref().is_some_and(|d| d.join(name).exists());
    let mode = decide(user_set, exists(SAFE_MODE), exists(START_MARKER));
    match mode {
        Mode::UserChoice => {}
        Mode::Gpu => {
            if std::env::var_os("__NV_DISABLE_EXPLICIT_SYNC").is_none() {
                // SAFETY: Läuft vor dem Start weiterer Threads.
                unsafe { std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1") };
            }
        }
        Mode::Safe { newly_detected } => {
            // SAFETY: Läuft vor dem Start weiterer Threads.
            unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
            if newly_detected && let Some(d) = &dir {
                let _ = std::fs::write(d.join(SAFE_MODE), b"1");
            }
        }
    }
    if let Some(d) = &dir {
        let _ = std::fs::create_dir_all(d);
        let _ = std::fs::write(d.join(START_MARKER), b"1");
    }
}

/// Start gelungen (nach `STARTUP_GRACE`) oder App normal beendet: Marke entfernen.
pub fn mark_started() {
    if let Some(d) = data_dir() {
        let _ = std::fs::remove_file(d.join(START_MARKER));
    }
}

#[cfg(test)]
mod tests {
    use super::{Mode, decide};

    #[test]
    fn waehlt_gpu_und_faellt_nach_absturz_zurueck() {
        assert_eq!(decide(false, false, false), Mode::Gpu);
        assert_eq!(
            decide(false, false, true),
            Mode::Safe {
                newly_detected: true
            }
        );
        assert_eq!(
            decide(false, true, false),
            Mode::Safe {
                newly_detected: false
            }
        );
        assert_eq!(decide(true, true, true), Mode::UserChoice);
    }
}
