//! API-Key im Schlüsselbund des Betriebssystems (Linux: Secret Service, z. B. gnome-keyring
//! oder KWallet). Der Key wird je Endpunkt-Origin gespeichert (`https://openrouter.ai`),
//! damit er nie an einen anderen Server gerät, wenn die Base-URL geändert wird.
//!
//! Der Key wird hier weder geloggt noch in Fehlermeldungen aufgenommen. Dasselbe gilt für den
//! Lichess-Token, der in einem eigenen Eintrag liegt.

use keyring::{Entry, Error};

const SERVICE: &str = "de.schachcoach.desktop";

/// Fehlercodes für das Frontend
const ERR_UNAVAILABLE: &str = "unavailable";
const ERR_INVALID_URL: &str = "invalidUrl";
const ERR_FAILED: &str = "failed";

/// Konto-Name im Schlüsselbund: `llm-api-key@<origin>`
fn account_for(base_url: &str) -> Result<String, &'static str> {
    let url = url::Url::parse(base_url.trim()).map_err(|_| ERR_INVALID_URL)?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err(ERR_INVALID_URL),
    }
    Ok(format!(
        "llm-api-key@{}",
        url.origin().ascii_serialization()
    ))
}

fn entry(base_url: &str) -> Result<Entry, &'static str> {
    let account = account_for(base_url)?;
    Entry::new(SERVICE, &account).map_err(|e| match e {
        Error::NoDefaultStore => ERR_UNAVAILABLE,
        _ => ERR_FAILED,
    })
}

/// Ist ein Schlüsselbund verfügbar?
#[tauri::command]
pub fn api_key_available() -> bool {
    Entry::store_status().is_ok()
}

/// Liest den Key für diesen Endpunkt; `None`, wenn keiner gespeichert ist.
#[tauri::command]
pub fn api_key_get(base_url: String) -> Result<Option<String>, String> {
    match entry(&base_url)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(Error::NoEntry) => Ok(None),
        Err(_) => Err(ERR_FAILED.into()),
    }
}

/// Speichert den Key für diesen Endpunkt. Ein leerer Key löscht den Eintrag.
#[tauri::command]
pub fn api_key_set(base_url: String, key: String) -> Result<(), String> {
    let entry = entry(&base_url)?;
    let key = key.trim();
    let result = if key.is_empty() {
        match entry.delete_credential() {
            Err(Error::NoEntry) => Ok(()),
            other => other,
        }
    } else {
        entry.set_password(key)
    };
    result.map_err(|_| ERR_FAILED.into())
}

/// Konto für den Lichess-Token (fest an https://lichess.org gebunden)
const LICHESS_ACCOUNT: &str = "lichess-token@https://lichess.org";

fn lichess_entry() -> Result<Entry, &'static str> {
    Entry::new(SERVICE, LICHESS_ACCOUNT).map_err(|e| match e {
        Error::NoDefaultStore => ERR_UNAVAILABLE,
        _ => ERR_FAILED,
    })
}

/// Liest den Lichess-Token; `None`, wenn keiner gespeichert ist.
#[tauri::command]
pub fn lichess_token_get() -> Result<Option<String>, String> {
    match lichess_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(Error::NoEntry) => Ok(None),
        Err(_) => Err(ERR_FAILED.into()),
    }
}

/// Speichert den Lichess-Token; ein leerer Token löscht den Eintrag.
#[tauri::command]
pub fn lichess_token_set(token: String) -> Result<(), String> {
    let entry = lichess_entry()?;
    let token = token.trim();
    let result = if token.is_empty() {
        match entry.delete_credential() {
            Err(Error::NoEntry) => Ok(()),
            other => other,
        }
    } else {
        entry.set_password(token)
    };
    result.map_err(|_| ERR_FAILED.into())
}

#[cfg(test)]
mod tests {
    use super::account_for;

    #[test]
    fn konto_haengt_nur_am_origin() {
        assert_eq!(
            account_for("https://openrouter.ai/api/v1").unwrap(),
            "llm-api-key@https://openrouter.ai"
        );
        assert_eq!(
            account_for("http://localhost:11434/v1").unwrap(),
            "llm-api-key@http://localhost:11434"
        );
    }

    #[test]
    fn andere_origins_bekommen_andere_konten() {
        assert_ne!(
            account_for("https://api.openai.com/v1").unwrap(),
            account_for("https://openrouter.ai/api/v1").unwrap()
        );
    }

    #[test]
    fn lehnt_ungueltige_urls_ab() {
        assert!(account_for("kein url").is_err());
        assert!(account_for("file:///etc/passwd").is_err());
    }
}
