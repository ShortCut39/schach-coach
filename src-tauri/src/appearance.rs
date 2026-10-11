//! Eigene Figuren, Bretter und Töne im App-Datenordner (`<app_data>/appearance/<art>/<id>/`).
//!
//! Je Satz ein Ordner mit zufälliger ID (UUID aus dem Frontend). Die Dateinamen vergibt die App
//! selbst (`wK.svg`, `board.png`, `move.ogg`, `meta.json`), nie die Originalnamen: Art, ID und
//! Dateiname werden hier gegen feste Muster geprüft, damit kein Pfad außerhalb des Ordners
//! entsteht. Zusätzlich passt der Dateianfang (Magic Bytes) zur Endung, und die Größe ist begrenzt.
//! Es gibt kein Datei-Plugin und keine Dateirechte für die WebView: nur diese Befehle.

use std::path::PathBuf;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

const ERR_INVALID: &str = "invalid";
const ERR_TOO_LARGE: &str = "tooLarge";
const ERR_TYPE: &str = "type";
const ERR_FAILED: &str = "failed";

const PIECES: [&str; 12] = [
    "wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP",
];
/// Plätze eines eigenen Ton-Sets (wie `SOUND_EVENTS` in `src/appearance/soundMapping.ts`)
const SOUND_SLOTS: [&str; 11] = [
    "move",
    "capture",
    "castle",
    "check",
    "promotion",
    "gameStart",
    "gameEnd",
    "victory",
    "defeat",
    "draw",
    "lowTime",
];

fn valid_kind(kind: &str) -> bool {
    matches!(kind, "pieces" | "boards" | "sounds")
}

/// UUID in Kleinbuchstaben: 8-4-4-4-12 Hex-Zeichen
fn valid_id(id: &str) -> bool {
    let parts: Vec<&str> = id.split('-').collect();
    parts.len() == 5
        && parts.iter().zip([8, 4, 4, 4, 12]).all(|(part, len)| {
            part.len() == len
                && part
                    .chars()
                    .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
        })
}

/// Erlaubter Dateiname je Art; liefert die Endung (bzw. `json` für die Metadaten).
fn file_type<'a>(kind: &str, file: &'a str) -> Option<&'a str> {
    if file == "meta.json" {
        return Some("json");
    }
    let (stem, ext) = file.split_once('.')?;
    let ok = match kind {
        "pieces" => PIECES.contains(&stem) && matches!(ext, "svg" | "png" | "webp"),
        "boards" => stem == "board" && matches!(ext, "svg" | "png" | "jpg" | "webp"),
        "sounds" => SOUND_SLOTS.contains(&stem) && matches!(ext, "ogg" | "mp3" | "wav" | "flac"),
        _ => false,
    };
    ok.then_some(ext)
}

fn max_bytes(kind: &str, ext: &str) -> usize {
    match (kind, ext) {
        (_, "json") => 16 * 1024,
        ("boards", _) => 5 * 1024 * 1024,
        _ => 2 * 1024 * 1024,
    }
}

/// Passt der Dateianfang zur Endung? (SVG: Text mit `<svg` am Anfang; genauer prüft das Frontend)
fn content_matches(ext: &str, bytes: &[u8]) -> bool {
    match ext {
        "png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "jpg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "webp" => bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        "ogg" => bytes.starts_with(b"OggS"),
        "flac" => bytes.starts_with(b"fLaC"),
        "wav" => bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WAVE",
        "mp3" => {
            bytes.starts_with(b"ID3")
                || (bytes.len() >= 2 && bytes[0] == 0xff && bytes[1] & 0xe0 == 0xe0)
        }
        "svg" => std::str::from_utf8(&bytes[..bytes.len().min(4096)])
            .map(|head| head.contains("<svg"))
            .unwrap_or(false),
        "json" => serde_json::from_slice::<serde_json::Value>(bytes).is_ok(),
        _ => false,
    }
}

fn base_dir(app: &AppHandle, kind: &str) -> Result<PathBuf, String> {
    if !valid_kind(kind) {
        return Err(ERR_INVALID.into());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| ERR_FAILED.to_string())?
        .join("appearance")
        .join(kind);
    std::fs::create_dir_all(&dir).map_err(|_| ERR_FAILED.to_string())?;
    Ok(dir)
}

fn set_dir(app: &AppHandle, kind: &str, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(ERR_INVALID.into());
    }
    Ok(base_dir(app, kind)?.join(id))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSet {
    id: String,
    /// Inhalt von `meta.json` (geprüft wird im Frontend), `None` wenn sie fehlt
    meta: Option<String>,
    files: Vec<String>,
}

/// Alle eigenen Sätze einer Art mit Metadaten und Dateiliste.
#[tauri::command]
pub fn appearance_list(app: AppHandle, kind: String) -> Result<Vec<StoredSet>, String> {
    let dir = base_dir(&app, &kind)?;
    let mut sets = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|_| ERR_FAILED.to_string())? {
        let Ok(entry) = entry else { continue };
        let id = entry.file_name().to_string_lossy().to_string();
        if !valid_id(&id) || !entry.path().is_dir() {
            continue;
        }
        let mut files = Vec::new();
        if let Ok(inner) = std::fs::read_dir(entry.path()) {
            for file in inner.flatten() {
                let name = file.file_name().to_string_lossy().to_string();
                if name != "meta.json" && file_type(&kind, &name).is_some() {
                    files.push(name);
                }
            }
        }
        files.sort();
        let meta = std::fs::read_to_string(entry.path().join("meta.json")).ok();
        sets.push(StoredSet { id, meta, files });
    }
    Ok(sets)
}

/// Inhalt einer Datei als Bytes.
#[tauri::command]
pub fn appearance_read(
    app: AppHandle,
    kind: String,
    id: String,
    file: String,
) -> Result<Response, String> {
    if file_type(&kind, &file).is_none() {
        return Err(ERR_INVALID.into());
    }
    let path = set_dir(&app, &kind, &id)?.join(&file);
    std::fs::read(path)
        .map(Response::new)
        .map_err(|_| ERR_FAILED.into())
}

fn header<'a>(request: &'a Request<'_>, name: &str) -> &'a str {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
}

/// Prüft eine Datei, bevor sie geschrieben wird; liefert die Endung.
fn check_write<'a>(kind: &str, file: &'a str, bytes: &[u8]) -> Result<&'a str, &'static str> {
    if !valid_kind(kind) {
        return Err(ERR_INVALID);
    }
    let ext = file_type(kind, file).ok_or(ERR_INVALID)?;
    if bytes.is_empty() || bytes.len() > max_bytes(kind, ext) {
        return Err(ERR_TOO_LARGE);
    }
    if !content_matches(ext, bytes) {
        return Err(ERR_TYPE);
    }
    Ok(ext)
}

/// Schreibt eine Datei (Bytes im Rumpf; Art, ID und Name in den Headern `x-kind`, `x-id`,
/// `x-file`). Eine vorhandene Datei desselben Platzes mit anderer Endung wird entfernt.
#[tauri::command]
pub fn appearance_write(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let (kind, id, file) = (
        header(&request, "x-kind"),
        header(&request, "x-id"),
        header(&request, "x-file"),
    );
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(ERR_INVALID.into());
    };
    check_write(kind, file, bytes).map_err(String::from)?;
    let dir = set_dir(&app, kind, id)?;
    std::fs::create_dir_all(&dir).map_err(|_| ERR_FAILED.to_string())?;
    // Erst unter anderem Namen schreiben, dann umbenennen: keine halben Dateien
    let temp = dir.join(format!(".{file}.tmp"));
    std::fs::write(&temp, bytes).map_err(|_| ERR_FAILED.to_string())?;
    if let Some((stem, _)) = file.split_once('.')
        && let Ok(entries) = std::fs::read_dir(&dir)
    {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name != file && name.split_once('.').is_some_and(|(s, _)| s == stem) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    std::fs::rename(&temp, dir.join(file)).map_err(|_| ERR_FAILED.to_string())
}

/// Entfernt eine einzelne Datei eines Satzes (z. B. einen eigenen Ton).
#[tauri::command]
pub fn appearance_remove_file(
    app: AppHandle,
    kind: String,
    id: String,
    file: String,
) -> Result<(), String> {
    if file_type(&kind, &file).is_none() {
        return Err(ERR_INVALID.into());
    }
    match std::fs::remove_file(set_dir(&app, &kind, &id)?.join(file)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(ERR_FAILED.into()),
    }
}

/// Löscht einen ganzen Satz.
#[tauri::command]
pub fn appearance_delete(app: AppHandle, kind: String, id: String) -> Result<(), String> {
    match std::fs::remove_dir_all(set_dir(&app, &kind, &id)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(ERR_FAILED.into()),
    }
}

/// Endungen, die per Drag & Drop für die Darstellung gelesen werden dürfen
const DROP_EXTENSIONS: [&str; 10] = [
    "svg", "png", "webp", "jpg", "jpeg", "ogg", "mp3", "wav", "flac", "zip",
];
const MAX_DROP_BYTES: u64 = 20 * 1024 * 1024;

fn read_dropped(path: &std::path::Path) -> Result<Vec<u8>, &'static str> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !DROP_EXTENSIONS.contains(&ext.as_str()) {
        return Err(ERR_TYPE);
    }
    let meta = std::fs::metadata(path).map_err(|_| ERR_FAILED)?;
    if !meta.is_file() {
        return Err(ERR_FAILED);
    }
    if meta.len() > MAX_DROP_BYTES {
        return Err(ERR_TOO_LARGE);
    }
    std::fs::read(path).map_err(|_| ERR_FAILED)
}

/// Liest eine Datei, die auf das Fenster gezogen wurde (WebKitGTK liefert beim HTML5-Drop keine
/// Inhalte). Nur Bild-, Ton- und ZIP-Endungen, höchstens 20 MB; geprüft wird danach im Frontend.
#[tauri::command]
pub async fn appearance_read_dropped(path: String) -> Result<Response, String> {
    read_dropped(std::path::Path::new(&path))
        .map(Response::new)
        .map_err(String::from)
}

/// Quellen der mitgelieferten Sätze (Lizenzseite): nur Ordner im Lichess-Repository
const SOURCE_PREFIX: &str = "https://github.com/lichess-org/lila/tree/master/public/";

fn is_source_url(url: &str) -> bool {
    url.strip_prefix(SOURCE_PREFIX).is_some_and(|rest| {
        !rest.is_empty()
            && rest
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '-' | '_'))
            && !rest.contains("//")
    })
}

/// Öffnet die Quelle eines mitgelieferten Satzes im Browser (nur Lichess-Ordner auf GitHub).
#[tauri::command]
pub fn appearance_open_source(url: String) -> Result<(), String> {
    if !is_source_url(&url) {
        return Err(ERR_INVALID.into());
    }
    #[allow(deprecated)]
    tauri_plugin_shell::open::open(None, &url, None).map_err(|_| ERR_FAILED.to_string())
}

#[cfg(test)]
mod tests {
    use super::{check_write, file_type, is_source_url, read_dropped, valid_id};

    #[test]
    fn oeffnet_nur_lichess_quellen() {
        assert!(is_source_url(
            "https://github.com/lichess-org/lila/tree/master/public/piece/cburnett"
        ));
        assert!(!is_source_url(
            "https://github.com/lichess-org/lila/tree/master/public/"
        ));
        assert!(!is_source_url("https://example.org/piece"));
        assert!(!is_source_url(
            "https://github.com/lichess-org/lila/tree/master/public/../x?y"
        ));
        assert!(!is_source_url(
            "https://github.com/lichess-org/lila/tree/master/public/a b"
        ));
    }

    #[test]
    fn liest_nur_erlaubte_abgelegte_dateien() {
        let dir = std::env::temp_dir().join(format!("schach-coach-drop-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let ok = dir.join("Figur.PNG");
        std::fs::write(&ok, b"x").unwrap();
        assert_eq!(read_dropped(&ok), Ok(b"x".to_vec()));
        let bad = dir.join("skript.sh");
        std::fs::write(&bad, b"x").unwrap();
        assert_eq!(read_dropped(&bad), Err("type"));
        assert_eq!(read_dropped(&dir), Err("type"));
        assert_eq!(read_dropped(&dir.join("fehlt.ogg")), Err("failed"));
    }

    #[test]
    fn erlaubt_nur_uuids() {
        assert!(valid_id("0b7e9c1a-1111-4222-8333-444455556666"));
        assert!(!valid_id(""));
        assert!(!valid_id("../../etc"));
        assert!(!valid_id("0B7E9C1A-1111-4222-8333-444455556666"));
        assert!(!valid_id("0b7e9c1a-1111-4222-8333-44445555666/"));
        assert!(!valid_id("0b7e9c1a11114222833344445555666612345"));
    }

    #[test]
    fn erlaubt_nur_feste_dateinamen() {
        assert_eq!(file_type("pieces", "wK.svg"), Some("svg"));
        assert_eq!(file_type("pieces", "bP.webp"), Some("webp"));
        assert_eq!(file_type("pieces", "xK.svg"), None);
        assert_eq!(file_type("pieces", "wK.svg.exe"), None);
        assert_eq!(file_type("pieces", "../wK.svg"), None);
        assert_eq!(file_type("boards", "board.jpg"), Some("jpg"));
        assert_eq!(file_type("sounds", "move.ogg"), Some("ogg"));
        assert_eq!(file_type("sounds", "move.svg"), None);
        assert_eq!(file_type("sounds", "meta.json"), Some("json"));
    }

    #[test]
    fn prueft_inhalt_und_groesse() {
        let png = b"\x89PNG\r\n\x1a\n0000".to_vec();
        assert!(check_write("pieces", "wK.png", &png).is_ok());
        assert_eq!(check_write("pieces", "wK.png", b"<svg/>"), Err("type"));
        assert_eq!(check_write("pieces", "wK.png", &[]), Err("tooLarge"));
        let big = [png.clone(), vec![0; 2 * 1024 * 1024]].concat();
        assert_eq!(check_write("pieces", "wK.png", &big), Err("tooLarge"));
        assert!(check_write("boards", "board.png", &big).is_ok());
        assert!(check_write("pieces", "wK.svg", b"<?xml version=\"1.0\"?><svg></svg>").is_ok());
        assert!(check_write("sounds", "move.ogg", b"OggS0000").is_ok());
        assert_eq!(
            check_write("sounds", "move.ogg", b"RIFF0000WAVE"),
            Err("type")
        );
        assert!(check_write("sounds", "meta.json", b"{\"name\":\"x\"}").is_ok());
        assert_eq!(check_write("sounds", "meta.json", b"{kaputt"), Err("type"));
        assert_eq!(check_write("other", "meta.json", b"{}"), Err("invalid"));
    }
}
