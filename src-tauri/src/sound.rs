//! Spieltöne über das Standard-Audiogerät (rodio), ohne Audio in der WebView.
//!
//! Grund: Unter Linux (WebKitGTK + GStreamer) konnte sich die WebView beim Abspielen über
//! `<audio>` verhaken (Deadlock zwischen Haupt- und GStreamer-Thread); WebKit hat den Prozess
//! dann beendet. WebAudio war dort stumm. Deshalb legt das Frontend jeden Ton einmal ab und lässt
//! ihn hier abspielen (`sound_play`):
//! - selbst berechnete Töne als Samples (`sound_register`),
//! - Ton-Dateien (OGG, MP3, WAV, FLAC) als Bytes (`sound_register_file`). Dekodiert wird hier mit
//!   symphonia, also unabhängig von den GStreamer-Plugins des Systems. `sound_probe` prüft eine
//!   Datei nur (beim Hochladen eigener Töne).
//!
//! Alles läuft auf einem eigenen Thread; die Befehle legen nur eine Nachricht in die Warteschlange
//! und kehren sofort zurück. Fehlt ein Audiogerät, bleibt es still.

use std::collections::HashMap;
use std::io::Cursor;
use std::num::NonZero;
use std::sync::mpsc::{Sender, channel};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Source, buffer::SamplesBuffer};
use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};

/// Höchstlänge eines Tons in Millisekunden (eigene Töne dürfen 5 s lang sein, etwas Spielraum)
const MAX_MILLIS: u64 = 5_100;
/// Größte Ton-Datei
const MAX_FILE_BYTES: usize = 2 * 1024 * 1024;
/// Nach einem fehlgeschlagenen Öffnen des Geräts so lange warten, bevor es erneut versucht wird
const RETRY_AFTER: Duration = Duration::from_secs(5);

/// Ein abspielbereiter Ton im Speicher
#[derive(Clone)]
struct Sound {
    channels: NonZero<u16>,
    rate: NonZero<u32>,
    samples: Vec<f32>,
}

impl Sound {
    fn duration_ms(&self) -> u64 {
        let frames = self.samples.len() as u64 / u64::from(self.channels.get());
        frames * 1000 / u64::from(self.rate.get())
    }
}

enum Message {
    Register { key: String, sound: Sound },
    Play { key: String, volume: f32 },
}

fn sender() -> &'static Mutex<Sender<Message>> {
    static SENDER: OnceLock<Mutex<Sender<Message>>> = OnceLock::new();
    SENDER.get_or_init(|| {
        let (tx, rx) = channel::<Message>();
        std::thread::Builder::new()
            .name("schach-coach-sound".into())
            .spawn(move || {
                let mut sounds: HashMap<String, Sound> = HashMap::new();
                let mut sink: Option<MixerDeviceSink> = None;
                let mut failed_at: Option<Instant> = None;
                for message in rx {
                    match message {
                        Message::Register { key, sound } => {
                            sounds.insert(key, sound);
                        }
                        Message::Play { key, volume } => {
                            let Some(sound) = sounds.get(&key) else {
                                continue;
                            };
                            if sink.is_none() {
                                if failed_at.is_some_and(|t| t.elapsed() < RETRY_AFTER) {
                                    continue;
                                }
                                match DeviceSinkBuilder::open_default_sink() {
                                    Ok(mut opened) => {
                                        opened.log_on_drop(false);
                                        sink = Some(opened);
                                        failed_at = None;
                                    }
                                    Err(_) => {
                                        failed_at = Some(Instant::now());
                                        continue;
                                    }
                                }
                            }
                            if let Some(sink) = &sink {
                                let source = SamplesBuffer::new(
                                    sound.channels,
                                    sound.rate,
                                    sound.samples.clone(),
                                )
                                .amplify(volume);
                                sink.mixer().add(source);
                            }
                        }
                    }
                }
            })
            .expect("Ton-Thread starten");
        Mutex::new(tx)
    })
}

fn send(message: Message) {
    if let Ok(tx) = sender().lock() {
        let _ = tx.send(message);
    }
}

/// Schlüssel eines Tons, z. B. `synth:move` oder `sfx:capture`: nur kurze, einfache Zeichen.
fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 80
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ':' | '-' | '_' | '/'))
}

fn max_samples(rate: u32, channels: u16) -> usize {
    (MAX_MILLIS * u64::from(rate) / 1000) as usize * usize::from(channels)
}

/// Prüft die Daten eines berechneten Tons; `Err` bei unsinnigen Werten.
pub fn validate(sample_rate: u32, samples: &[f32]) -> Result<(), &'static str> {
    if !(8_000..=96_000).contains(&sample_rate) {
        return Err("sampleRate");
    }
    if samples.is_empty() || samples.len() > max_samples(sample_rate, 1) {
        return Err("length");
    }
    if samples.iter().any(|s| !s.is_finite()) {
        return Err("samples");
    }
    Ok(())
}

/// Dekodiert eine Ton-Datei. Fehlercodes: `empty`, `tooLarge`, `unsupported`, `tooLong`.
fn decode(bytes: Vec<u8>) -> Result<Sound, &'static str> {
    if bytes.is_empty() {
        return Err("empty");
    }
    if bytes.len() > MAX_FILE_BYTES {
        return Err("tooLarge");
    }
    let decoder = Decoder::try_from(Cursor::new(bytes)).map_err(|_| "unsupported")?;
    let channels = decoder.channels();
    let rate = decoder.sample_rate();
    if !(8_000..=192_000).contains(&rate.get()) || channels.get() > 8 {
        return Err("unsupported");
    }
    let limit = max_samples(rate.get(), channels.get());
    let mut samples = Vec::new();
    for sample in decoder {
        // Abbrechen statt alles zu dekodieren: schützt vor sehr langen (oder „aufgeblähten“) Dateien
        if samples.len() >= limit {
            return Err("tooLong");
        }
        samples.push(if sample.is_finite() {
            sample.clamp(-1.0, 1.0)
        } else {
            0.0
        });
    }
    if samples.is_empty() {
        return Err("unsupported");
    }
    Ok(Sound {
        channels,
        rate,
        samples,
    })
}

fn raw_body(request: &Request<'_>) -> Result<Vec<u8>, String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes.clone()),
        InvokeBody::Json(_) => Err("body".into()),
    }
}

fn header_key(request: &Request<'_>) -> Result<String, String> {
    let key = request
        .headers()
        .get("x-sound-key")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    if valid_key(&key) {
        Ok(key)
    } else {
        Err("key".into())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundInfo {
    duration_ms: u64,
}

/// Legt einen berechneten Ton ab (Samples, mono).
#[tauri::command]
pub fn sound_register(kind: String, sample_rate: u32, samples: Vec<f32>) -> Result<(), String> {
    if !valid_key(&kind) {
        return Err("key".into());
    }
    validate(sample_rate, &samples).map_err(String::from)?;
    let rate = NonZero::new(sample_rate).ok_or("sampleRate")?;
    send(Message::Register {
        key: kind,
        sound: Sound {
            channels: NonZero::<u16>::MIN,
            rate,
            samples: samples.into_iter().map(|s| s.clamp(-1.0, 1.0)).collect(),
        },
    });
    Ok(())
}

/// Dekodiert eine Ton-Datei (Bytes im Rumpf, Schlüssel im Header `x-sound-key`) und legt sie ab.
#[tauri::command]
pub fn sound_register_file(request: Request<'_>) -> Result<SoundInfo, String> {
    let key = header_key(&request)?;
    let sound = decode(raw_body(&request)?).map_err(String::from)?;
    let info = SoundInfo {
        duration_ms: sound.duration_ms(),
    };
    send(Message::Register { key, sound });
    Ok(info)
}

/// Prüft nur, ob sich eine Datei dekodieren lässt (und wie lang sie ist).
#[tauri::command]
pub fn sound_probe(request: Request<'_>) -> Result<SoundInfo, String> {
    let sound = decode(raw_body(&request)?).map_err(String::from)?;
    Ok(SoundInfo {
        duration_ms: sound.duration_ms(),
    })
}

/// Spielt einen abgelegten Ton; `volume` von 0 bis 1.
#[tauri::command]
pub fn sound_play(kind: String, volume: f32) {
    let volume = if volume.is_finite() {
        volume.clamp(0.0, 1.0)
    } else {
        0.0
    };
    if volume > 0.0 && valid_key(&kind) {
        send(Message::Play { key: kind, volume });
    }
}

#[cfg(test)]
mod tests {
    use super::{decode, valid_key, validate};

    #[test]
    fn prueft_die_tondaten() {
        assert!(validate(22_050, &[0.0, 0.5, -0.5]).is_ok());
        assert!(validate(0, &[0.0]).is_err());
        assert!(validate(22_050, &[]).is_err());
        assert!(validate(22_050, &[f32::NAN]).is_err());
        assert!(validate(22_050, &vec![0.0; 1_000_000]).is_err());
    }

    #[test]
    fn erlaubt_nur_einfache_schluessel() {
        assert!(valid_key("sfx:move"));
        assert!(valid_key(
            "custom:0b7e9c1a-1111-4222-8333-444455556666:check"
        ));
        assert!(!valid_key(""));
        assert!(!valid_key("a b"));
        assert!(!valid_key(&"a".repeat(81)));
    }

    /// WAV (PCM 16 Bit, mono) mit `frames` Abtastwerten
    fn wav(rate: u32, frames: u32) -> Vec<u8> {
        let mut out = Vec::new();
        let data = frames * 2;
        out.extend_from_slice(b"RIFF");
        out.extend_from_slice(&(36 + data).to_le_bytes());
        out.extend_from_slice(b"WAVEfmt ");
        out.extend_from_slice(&16u32.to_le_bytes());
        out.extend_from_slice(&1u16.to_le_bytes());
        out.extend_from_slice(&1u16.to_le_bytes());
        out.extend_from_slice(&rate.to_le_bytes());
        out.extend_from_slice(&(rate * 2).to_le_bytes());
        out.extend_from_slice(&2u16.to_le_bytes());
        out.extend_from_slice(&16u16.to_le_bytes());
        out.extend_from_slice(b"data");
        out.extend_from_slice(&data.to_le_bytes());
        for i in 0..frames {
            out.extend_from_slice(&(((i % 100) as i16 - 50) * 300).to_le_bytes());
        }
        out
    }

    #[test]
    fn dekodiert_wav_und_misst_die_laenge() {
        let sound = decode(wav(22_050, 11_025)).expect("WAV lesbar");
        assert_eq!(sound.duration_ms(), 500);
    }

    #[test]
    fn lehnt_kaputte_zu_lange_und_zu_grosse_dateien_ab() {
        assert_eq!(decode(Vec::new()).err(), Some("empty"));
        assert_eq!(decode(b"kein Ton".to_vec()).err(), Some("unsupported"));
        assert_eq!(decode(wav(8_000, 8_000 * 6)).err(), Some("tooLong"));
        assert_eq!(decode(vec![0; 3 * 1024 * 1024]).err(), Some("tooLarge"));
    }

    #[test]
    fn dekodiert_die_mitgelieferten_toene() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/assets/sounds");
        let mut count = 0;
        for set in std::fs::read_dir(dir).expect("Ordner der Töne") {
            for file in std::fs::read_dir(set.unwrap().path()).unwrap() {
                let path = file.unwrap().path();
                let sound = decode(std::fs::read(&path).unwrap())
                    .unwrap_or_else(|e| panic!("{}: {e}", path.display()));
                assert!(sound.duration_ms() > 0);
                count += 1;
            }
        }
        assert_eq!(count, 32);
    }
}
