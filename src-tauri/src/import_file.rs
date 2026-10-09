//! Liest Dateien, die per Drag & Drop auf das Fenster gezogen wurden.
//!
//! Unter Linux liefert WebKitGTK beim HTML5-Drop keine Dateiinhalte. Deshalb fängt Tauri
//! das Ablegen ab, das Frontend bekommt den Pfad und lässt die Datei hier lesen.
//! Erlaubt sind nur Textformate für den Import, mit Größenlimit.

use std::path::Path;

const MAX_IMPORT_BYTES: u64 = 20 * 1024 * 1024;
const IMPORT_EXTENSIONS: [&str; 3] = ["pgn", "txt", "fen"];

/// Fehlercodes, die das Frontend in verständliche Texte übersetzt.
pub const ERR_UNSUPPORTED: &str = "unsupported";
pub const ERR_TOO_LARGE: &str = "tooLarge";
pub const ERR_UNREADABLE: &str = "unreadable";

fn has_import_extension(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| IMPORT_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
    .unwrap_or(false)
}

pub fn read_checked(path: &Path) -> Result<Vec<u8>, &'static str> {
  if !has_import_extension(path) {
    return Err(ERR_UNSUPPORTED);
  }
  let meta = std::fs::metadata(path).map_err(|_| ERR_UNREADABLE)?;
  if !meta.is_file() {
    return Err(ERR_UNREADABLE);
  }
  if meta.len() > MAX_IMPORT_BYTES {
    return Err(ERR_TOO_LARGE);
  }
  std::fs::read(path).map_err(|_| ERR_UNREADABLE)
}

/// Gibt die Rohbytes zurück (im Frontend ein `ArrayBuffer`); dekodiert wird dort.
#[tauri::command]
pub async fn read_import_file(path: String) -> Result<tauri::ipc::Response, String> {
  read_checked(Path::new(&path))
    .map(tauri::ipc::Response::new)
    .map_err(String::from)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Write;

  fn temp_file(name: &str, content: &[u8]) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("schach-coach-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join(name);
    std::fs::File::create(&path).unwrap().write_all(content).unwrap();
    path
  }

  #[test]
  fn liest_pgn_dateien() {
    let path = temp_file("partie.PGN", b"1. e4 e5 *");
    assert_eq!(read_checked(&path).unwrap(), b"1. e4 e5 *");
  }

  #[test]
  fn lehnt_andere_endungen_ab() {
    let path = temp_file("bild.png", b"x");
    assert_eq!(read_checked(&path), Err(ERR_UNSUPPORTED));
    assert_eq!(read_checked(Path::new("/ohne/endung")), Err(ERR_UNSUPPORTED));
  }

  #[test]
  fn meldet_fehlende_dateien_und_ordner() {
    assert_eq!(read_checked(Path::new("/gibt/es/nicht.pgn")), Err(ERR_UNREADABLE));
    let dir = std::env::temp_dir().join(format!("schach-coach-ordner-{}.pgn", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    assert_eq!(read_checked(&dir), Err(ERR_UNREADABLE));
  }
}
