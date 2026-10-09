//! Lokale Bibliothek: analysierte Partien im App-Datenordner (`<app_data>/library`).
//!
//! Je Partie zwei Dateien: `<id>.meta.json` (klein, für die Liste) und `<id>.json`
//! (Bewertungen, Erklärungen, Zusammenfassung). Die IDs erzeugt das Frontend aus dem PGN;
//! erlaubt sind nur Kleinbuchstaben und Ziffern, damit kein Pfad außerhalb des Ordners entsteht.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const ERR_INVALID_ID: &str = "invalidId";
const ERR_FAILED: &str = "failed";

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

fn library_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| ERR_FAILED.to_string())?
        .join("library");
    std::fs::create_dir_all(&dir).map_err(|_| ERR_FAILED.to_string())?;
    Ok(dir)
}

fn checked(id: &str) -> Result<(), String> {
    if valid_id(id) {
        Ok(())
    } else {
        Err(ERR_INVALID_ID.into())
    }
}

/// Alle Metadaten (als JSON-Text; geprüft wird im Frontend).
#[tauri::command]
pub fn library_list(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = library_dir(&app)?;
    let mut metas = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|_| ERR_FAILED.to_string())? {
        let Ok(entry) = entry else { continue };
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(id) = name.strip_suffix(".meta.json") {
            if valid_id(id) {
                if let Ok(text) = std::fs::read_to_string(entry.path()) {
                    metas.push(text);
                }
            }
        }
    }
    Ok(metas)
}

/// Vollständige Daten einer Partie oder `None`.
#[tauri::command]
pub fn library_get(app: AppHandle, id: String) -> Result<Option<String>, String> {
    checked(&id)?;
    let path = library_dir(&app)?.join(format!("{id}.json"));
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err(ERR_FAILED.into()),
    }
}

#[tauri::command]
pub fn library_save(
    app: AppHandle,
    id: String,
    meta: String,
    record: String,
) -> Result<(), String> {
    checked(&id)?;
    let dir = library_dir(&app)?;
    std::fs::write(dir.join(format!("{id}.json")), record).map_err(|_| ERR_FAILED.to_string())?;
    std::fs::write(dir.join(format!("{id}.meta.json")), meta).map_err(|_| ERR_FAILED.to_string())
}

#[tauri::command]
pub fn library_delete(app: AppHandle, id: String) -> Result<(), String> {
    checked(&id)?;
    let dir = library_dir(&app)?;
    for name in [format!("{id}.json"), format!("{id}.meta.json")] {
        match std::fs::remove_file(dir.join(name)) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(ERR_FAILED.into()),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::valid_id;

    #[test]
    fn erlaubt_nur_sichere_ids() {
        assert!(valid_id("a1b2c3d4e5f60718"));
        assert!(!valid_id(""));
        assert!(!valid_id("../etc/passwd"));
        assert!(!valid_id("ABC"));
        assert!(!valid_id("a/b"));
        assert!(!valid_id(&"a".repeat(65)));
    }
}
