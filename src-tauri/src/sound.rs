//! Spieltöne über das Standard-Audiogerät (rodio), ohne Audio in der WebView.
//!
//! Grund: Unter Linux (WebKitGTK + GStreamer) konnte sich die WebView beim Abspielen über
//! `<audio>` verhaken (Deadlock zwischen Haupt- und GStreamer-Thread); WebKit hat den Prozess
//! dann beendet. WebAudio war dort stumm. Deshalb berechnet das Frontend die Töne, übergibt die
//! Samples einmal (`sound_register`) und lässt sie hier abspielen (`sound_play`).
//!
//! Alles läuft auf einem eigenen Thread; die Befehle legen nur eine Nachricht in die Warteschlange
//! und kehren sofort zurück. Fehlt ein Audiogerät, bleibt es still.

use std::collections::HashMap;
use std::num::NonZero;
use std::sync::mpsc::{Sender, channel};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use rodio::{DeviceSinkBuilder, MixerDeviceSink, Source, buffer::SamplesBuffer};

/// Höchstlänge eines Tons (Sekunden × Abtastrate), schützt vor unsinnigen Daten
const MAX_SAMPLES: usize = 5 * 48_000;
/// Nach einem fehlgeschlagenen Öffnen des Geräts so lange warten, bevor es erneut versucht wird
const RETRY_AFTER: Duration = Duration::from_secs(5);

enum Message {
    Register {
        kind: String,
        sample_rate: u32,
        samples: Vec<f32>,
    },
    Play {
        kind: String,
        volume: f32,
    },
}

fn sender() -> &'static Mutex<Sender<Message>> {
    static SENDER: OnceLock<Mutex<Sender<Message>>> = OnceLock::new();
    SENDER.get_or_init(|| {
        let (tx, rx) = channel::<Message>();
        std::thread::Builder::new()
            .name("schach-coach-sound".into())
            .spawn(move || {
                let mut sounds: HashMap<String, (NonZero<u32>, Vec<f32>)> = HashMap::new();
                let mut sink: Option<MixerDeviceSink> = None;
                let mut failed_at: Option<Instant> = None;
                for message in rx {
                    match message {
                        Message::Register {
                            kind,
                            sample_rate,
                            samples,
                        } => {
                            if let Some(rate) = NonZero::new(sample_rate) {
                                sounds.insert(kind, (rate, samples));
                            }
                        }
                        Message::Play { kind, volume } => {
                            let Some((rate, samples)) = sounds.get(&kind) else {
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
                                let source =
                                    SamplesBuffer::new(NonZero::<u16>::MIN, *rate, samples.clone())
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

/// Prüft die Daten eines Tons; `Err` bei unsinnigen Werten.
pub fn validate(sample_rate: u32, samples: &[f32]) -> Result<(), &'static str> {
    if !(8_000..=96_000).contains(&sample_rate) {
        return Err("sampleRate");
    }
    if samples.is_empty() || samples.len() > MAX_SAMPLES {
        return Err("length");
    }
    if samples.iter().any(|s| !s.is_finite()) {
        return Err("samples");
    }
    Ok(())
}

/// Legt einen Ton ab (einmal je Art, z. B. `move`).
#[tauri::command]
pub fn sound_register(kind: String, sample_rate: u32, samples: Vec<f32>) -> Result<(), String> {
    validate(sample_rate, &samples).map_err(String::from)?;
    send(Message::Register {
        kind,
        sample_rate,
        samples: samples.into_iter().map(|s| s.clamp(-1.0, 1.0)).collect(),
    });
    Ok(())
}

/// Spielt einen abgelegten Ton; `volume` von 0 bis 1.
#[tauri::command]
pub fn sound_play(kind: String, volume: f32) {
    let volume = if volume.is_finite() {
        volume.clamp(0.0, 1.0)
    } else {
        0.0
    };
    if volume > 0.0 {
        send(Message::Play { kind, volume });
    }
}

#[cfg(test)]
mod tests {
    use super::validate;

    #[test]
    fn prueft_die_tondaten() {
        assert!(validate(22_050, &[0.0, 0.5, -0.5]).is_ok());
        assert!(validate(0, &[0.0]).is_err());
        assert!(validate(22_050, &[]).is_err());
        assert!(validate(22_050, &[f32::NAN]).is_err());
        assert!(validate(22_050, &vec![0.0; 1_000_000]).is_err());
    }
}
