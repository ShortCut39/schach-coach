//! Lichess-Anmeldung (OAuth 2 mit PKCE) über eine Loopback-Adresse.
//!
//! Ablauf: Das Frontend fragt einen freien Port auf 127.0.0.1 an (`lichess_oauth_listen`), baut
//! damit die Anmelde-Adresse und lässt sie im Browser öffnen (`lichess_open`, nur
//! `https://lichess.org/…`). Lichess leitet danach auf `http://127.0.0.1:<port>/callback?…` um;
//! dieser Mini-Server nimmt genau diese eine Anfrage an, antwortet mit einer kurzen Seite und
//! meldet `code`, `state` bzw. `error` als Ereignis `lichess-oauth` ans Frontend.
//!
//! Den Code tauscht das Frontend selbst gegen den Token (es kennt den `code_verifier`). Code und
//! Token werden hier weder geloggt noch gespeichert.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Wie lange auf die Rückleitung gewartet wird
const WAIT: Duration = Duration::from_secs(10 * 60);
/// Laufende Anmeldung; eine neue beendet die alte
static GENERATION: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Serialize, Default, Debug, PartialEq)]
pub struct OAuthCallback {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

const PAGE: &str = "<!doctype html><html lang=\"de\"><meta charset=\"utf-8\"><title>Schach-Coach</title>\
<body style=\"font-family:sans-serif;background:#0b0e13;color:#dde3ec;display:grid;place-items:center;height:100vh;margin:0\">\
<div style=\"text-align:center\"><h1>Schach-Coach</h1>\
<p>Fertig. Du kannst dieses Fenster schließen und zur App zurückkehren.</p>\
<p>Done. You can close this window and return to the app.</p></div></body></html>";

/// Liest `code`, `state` und `error` aus der ersten Anfragezeile (`GET /callback?… HTTP/1.1`).
/// `None`, wenn es nicht die Rückleitung ist (z. B. `/favicon.ico`).
pub fn parse_callback(request_line: &str) -> Option<OAuthCallback> {
    let mut parts = request_line.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }
    let target = parts.next()?;
    let url = url::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != "/callback" {
        return None;
    }
    let mut result = OAuthCallback::default();
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "code" => result.code = Some(value.into_owned()),
            "state" => result.state = Some(value.into_owned()),
            "error" => result.error = Some(value.into_owned()),
            _ => {}
        }
    }
    if result.code.is_none() && result.error.is_none() {
        result.error = Some("invalid".into());
    }
    Some(result)
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{body}",
        body.len()
    );
}

/// Eine Verbindung bearbeiten; `Some`, wenn es die Rückleitung war.
fn handle(mut stream: TcpStream) -> Option<OAuthCallback> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buffer = [0u8; 8192];
    let read = stream.read(&mut buffer).ok()?;
    let text = String::from_utf8_lossy(&buffer[..read]);
    let first_line = text.lines().next().unwrap_or_default();
    match parse_callback(first_line) {
        Some(callback) => {
            respond(&mut stream, "200 OK", PAGE);
            Some(callback)
        }
        None => {
            respond(&mut stream, "404 Not Found", "");
            None
        }
    }
}

/// Öffnet einen Port auf 127.0.0.1 und wartet im Hintergrund auf die Rückleitung von Lichess.
/// Gibt den Port zurück; das Ergebnis kommt als Ereignis `lichess-oauth`.
#[tauri::command]
pub fn lichess_oauth_listen(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|_| "listen".to_string())?;
    let port = listener
        .local_addr()
        .map_err(|_| "listen".to_string())?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|_| "listen".to_string())?;
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        let deadline = Instant::now() + WAIT;
        let result = loop {
            if GENERATION.load(Ordering::SeqCst) != generation {
                return; // abgebrochen oder durch eine neue Anmeldung ersetzt
            }
            if Instant::now() > deadline {
                break OAuthCallback {
                    error: Some("timeout".into()),
                    ..Default::default()
                };
            }
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    if let Some(callback) = handle(stream) {
                        break callback;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(100));
                }
                Err(_) => {
                    break OAuthCallback {
                        error: Some("listen".into()),
                        ..Default::default()
                    };
                }
            }
        };
        let _ = app.emit("lichess-oauth", result);
    });
    Ok(port)
}

/// Bricht eine laufende Anmeldung ab (der Port wird freigegeben).
#[tauri::command]
pub fn lichess_oauth_cancel() {
    GENERATION.fetch_add(1, Ordering::SeqCst);
}

/// Nur Adressen auf https://lichess.org dürfen geöffnet werden.
pub fn is_lichess_url(url: &str) -> bool {
    match url::Url::parse(url) {
        Ok(parsed) => {
            parsed.scheme() == "https"
                && parsed.host_str() == Some("lichess.org")
                && parsed.port().is_none()
                && parsed.username().is_empty()
        }
        Err(_) => false,
    }
}

/// Öffnet eine Lichess-Seite im Standardbrowser (Anmeldung, Token erzeugen).
#[tauri::command]
pub fn lichess_open(url: String) -> Result<(), String> {
    if !is_lichess_url(&url) {
        return Err("invalidUrl".into());
    }
    #[allow(deprecated)]
    tauri_plugin_shell::open::open(None, &url, None).map_err(|_| "open".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn liest_code_und_state() {
        let cb = parse_callback("GET /callback?code=abc%2B1&state=xyz HTTP/1.1").unwrap();
        assert_eq!(cb.code.as_deref(), Some("abc+1"));
        assert_eq!(cb.state.as_deref(), Some("xyz"));
        assert_eq!(cb.error, None);
    }

    #[test]
    fn meldet_abgelehnte_anmeldung() {
        let cb = parse_callback("GET /callback?error=access_denied&state=xyz HTTP/1.1").unwrap();
        assert_eq!(cb.error.as_deref(), Some("access_denied"));
    }

    #[test]
    fn ignoriert_andere_anfragen() {
        assert!(parse_callback("GET /favicon.ico HTTP/1.1").is_none());
        assert!(parse_callback("POST /callback?code=a HTTP/1.1").is_none());
        assert_eq!(
            parse_callback("GET /callback HTTP/1.1")
                .unwrap()
                .error
                .as_deref(),
            Some("invalid")
        );
    }

    #[test]
    fn oeffnet_nur_lichess() {
        assert!(is_lichess_url("https://lichess.org/oauth?client_id=x"));
        assert!(is_lichess_url(
            "https://lichess.org/account/oauth/token/create"
        ));
        assert!(!is_lichess_url("http://lichess.org/oauth"));
        assert!(!is_lichess_url("https://lichess.org.evil.example/oauth"));
        assert!(!is_lichess_url(
            "https://evil.example/?https://lichess.org/"
        ));
        assert!(!is_lichess_url("https://user@lichess.org/"));
        assert!(!is_lichess_url("file:///etc/passwd"));
    }
}
