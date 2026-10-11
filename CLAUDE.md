# Schach-Coach – Hinweise für Claude

Tauri-2-Desktop-App: Partien (PGN/FEN, Lichess, Chess.com) laden, Stockfish 19 bewertet jede Stellung, jeder Zug wird klassifiziert (Brillant bis Patzer), ein LLM über einen OpenAI-kompatiblen Endpunkt erklärt. Dazu Bibliothek, Muster über viele Partien, Training aus eigenen Fehlern, Deutsch/Englisch und der Bereich **Spielen** (lokal gegen Stockfish mit Hilfen, live auf Lichess über die Board-API ohne Hilfen). Alle geplanten Features (M0–M6, Version 3, Spielen L1–L6) sind fertig; Releases v0.1.0–v0.2.0 sind auf GitHub (öffentlich: ShortCut39/schach-coach). Dazu **Darstellung**: Figuren, Brett und Töne wählen oder eigene hochladen (README-Abschnitt „Aussehen anpassen“, mitgelieferte Dateien in `THIRD_PARTY_ASSETS.md`). Details für Nutzer: `README.md` / `README.en.md`.

## Arbeitsweise

- Nach jeder Änderung müssen `pnpm typecheck`, `pnpm lint`, `pnpm test` und `pnpm format:check` grün sein.
- `README.md` und `README.en.md` immer gemeinsam aktuell halten.
- Kleine Commits. Persönliche Hinweise zur Zusammenarbeit stehen in `CLAUDE.local.md` (nur lokal).

## Feste Regeln (aus dem Projektdokument)

1. Das LLM rechnet nie selbst Schach. Es bekommt nur Daten von Stockfish und chess.js (Züge und Gefahren in Worten aus `src/llm/describe.ts`); der Prompt verbietet erfundene Züge, Varianten und Bewertungen.
2. Stockfish ist die einzige Quelle für Bewertungen.
3. Keine festen Texte in Komponenten: alles in `src/i18n/de.json` **und** `src/i18n/en.json` (gleiche Schlüssel und Platzhalter – Typecheck und `src/i18n/i18n.test.ts` prüfen das). Zahlen/Datum über `currentLocale()` bzw. `src/ui/format.ts`, nie `'de-DE'` fest.
4. Keine erfundenen Daten in der echten App (nur Tests/Fixtures).
5. Der API-Key wird nie geloggt, nie in Code geschrieben und nur an den eingestellten Endpunkt gesendet (Schlüsselbund, getrennt pro Origin: `src-tauri/src/secrets.rs`).
6. **Fair Play bei Lichess:** Während einer Live-Partie ist die Sperre `src/play/liveGuard.ts` aktiv. Durchgesetzt wird sie nur zentral (`UciEngine`, `getEngines`/`startStandaloneEngine`, `chatCompletion`), nie per `if` in Komponenten. Neue Engine- oder KI-Wege müssen dort durch. Der Lichess-Token geht nur an `https://lichess.org` (fester Host in `src/play/lichess/client.ts`), nur offizielle API-Endpunkte.
7. **Lizenzen mitgelieferter Dateien:** Nur eindeutig frei lizenzierte fremde Dateien (keine NC-, Freeware- oder lizenzlosen), unverändert, jede mit Autor, Lizenz, Quelle in `THIRD_PARTY_ASSETS.md` **und** `src/appearance/thirdParty.ts` (Test prüft beides) sowie Lizenztext in `assets/licenses/`. Die Lichess-Standardtöne (`public/sound/standard`) sind nicht frei und kommen nie ins Repo. Kein Download zur Laufzeit. Die App zeigt dieselbe Liste und die Lizenztexte unter Einstellungen → Darstellung → „Lizenzen und Quellen“ (`LicensesCard.tsx`); Quell-Links öffnet nur `appearance_open_source` (fest auf Lichess-Ordner auf GitHub).
8. **Eigene Dateien (Uploads):** SVG nie inline ins DOM, nur über `<img>`/CSS; vorher `checkSvg` (kein Skript, `foreignObject`, `on…`, externe Verweise). Inhalt immer per Magic Bytes prüfen (`src/appearance/validate.ts`, in Rust nochmal). Nichts verlässt den Rechner, Dateiinhalte nie loggen. CSP bleibt streng (Bilder als `blob:`/`data:`, Töne über Rust).

## Befehle

```bash
pnpm tauri dev        # Desktop-App (lädt vorher die native Engine: pnpm fetch:engine)
pnpm tauri build      # Installationspakete bauen (CI: .github/workflows/build.yml)
pnpm dev              # nur Frontend im Browser, Port 1420 (.claude/launch.json: "vite")
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
pnpm fetch:engine --target <triple>   # Stockfish-19-Binary nach src-tauri/binaries/ (nicht im Git)
pnpm build:openings   # Eröffnungsbuch aus data/chess-openings neu erzeugen
cd src-tauri && cargo test   # Rust-Tests (Pfadprüfung, Dekodieren der mitgelieferten Töne)
```

## Aufbau

- `src/play/` Spielen: `session/` (GameSession, LocalSession, LichessSession), `clock/`, `rules/`, `opponent/` (Stufen, Gegner-Engine), `lichess/` (Client, OAuth/PKCE, NDJSON, Lobby, Mapper), `liveGuard.ts`, `sound*.ts` · `src/store/play.ts`, `src/store/lichessAuth.ts` · `src/ui/play/`, `src/ui/screens/PlayScreen.tsx`.
- `src/chess/` PGN/FEN, Notation · `src/engine/` UCI, Engine-Pool (native Sidecar oder WASM) · `src/classification/` Gewinnchance, Kategorien, Motive, Muster, Eröffnungsbuch (`data/chess-openings` → `scripts/build-opening-book.mjs`) · `src/llm/` Prompts, Client, Fakten · `src/training/` Aufgaben, Zugprüfung, Leitner · `src/online/` Lichess/Chess.com · `src/store/` Zustand-Stores · `src/app/` Gesamttests über die ganze App · `src/test/` Test-Helfer und Fixtures.
- `src/ui/`: `screens/` (je Bereich ein Bildschirm), `analyse/` (Brett `BoardView`, Zugliste, Graph), `training/TrainingBoard.tsx` (ziehbares Brett, auch beim Spielen), `summary/`, `library/`, `import/`, `play/`, `appearance/` (Bereich „Darstellung“: Karten, Upload-Dialoge), `shared/` (Knöpfe, Formulare, Icons, `Modal`, `SettingsCard`). Die Einstellungen arbeiten mit Entwurf und „Speichern“-Knopf ganz unten (`EinstellungenScreen.tsx`), auch der Bereich „Darstellung“: Seine Vorschau zeigt den Entwurf (`useAppearancePreview`), übernommen wird mit `useAppearance.saveAll`. Hochladen, Umbenennen und Löschen eigener Sätze schreiben die Dateien dagegen sofort.
- `src/appearance/` Darstellung: Store `useAppearance` (Figuren, Brett, Töne, Koordinaten; gespeichert unter `appearance`), mitgelieferte Sätze (`pieces.ts`, `boards.ts`, `sounds.ts`, Dateien in `src/assets/`), `soundMapping.ts` (Ereignisse, Ersatzkette), `validate.ts`, `storage.ts` und `customSets.ts` (eigene Sätze), `fileNames.ts` (Zuordnung aus Dateinamen), `zip.ts` (fflate, Grenzen vor dem Entpacken). Alle Bretter holen ihr Aussehen nur über `useBoardAppearance()` (`src/ui/boardAppearance.tsx`), Töne nur über `playSound` (`src/play/sound.ts`).
- `src-tauri/` Rust (Datei-Import, Schlüsselbund inkl. Lichess-Token, Bibliothek, Lichess-Loopback für OAuth `lichess.rs`, Töne über rodio `sound.rs`, eigene Darstellungs-Dateien `appearance.rs`).
- KI-Texte gibt es in beiden Sprachen (`ExplanationLanguage`); die **Feldnamen der Fakten und Antworten bleiben deutsch** (`zug_in_worten`, `was`/`warum`/…), damit gespeicherte Analysen gültig bleiben – der englische Prompt erklärt sie.
- **Darstellung – Entscheidungen:** Eigene Sätze liegen im App-Datenordner `appearance/<art>/<uuid>/` mit selbst vergebenen Dateinamen und `meta.json`; Zugriff nur über die Rust-Befehle in `appearance.rs` (prüfen UUID, festen Dateinamen, Magic Bytes, Größe), kein Datei-Plugin und keine fs-Scopes. Ton-Dateien dekodiert Rust (rodio/symphonia: OGG, MP3, WAV, FLAC), unabhängig von GStreamer; das Frontend schickt die Bytes einmal (`sound_register_file`) und spielt per Schlüssel. Fehlt oder ist ein gewählter Satz defekt, gilt still der Standard (cburnett, „App-Standard“, `sfx`) mit einmaligem Hinweis (`AppearanceNotice`). Lautstärke und „Töne an/aus“ bleiben in den Einstellungen (`play.sounds`, `play.volume`). Ein Brettbild liegt als `boardStyle`-Hintergrund unter transparenten Feldern; Markierungen (letzter Zug, Ziele, Schach) bleiben `squareStyles` und liegen damit darüber. Nicht quadratische Brettbilder werden nur nach mittigem Zuschneiden (Canvas) angenommen. Eigene Ton-Sets haben einen Platz je Ereignis (`SOUND_EVENTS`); jede Datei wird vor dem Speichern probeweise dekodiert (`probeSound`: Rust bzw. im Browser-Modus `<audio>`), freie Plätze nutzen `sfx`.
- Gespeicherte Formate (Einstellungen, Darstellung, Sitzung, Bibliothek, `trainingCards`, `trainingExplanations`, `trainingPlan`) werden mit zod und `.catch(...)` gelesen; neue Felder immer abwärtskompatibel ergänzen.

## Stolperfallen (schon einmal passiert)

- **Tailwind-Breakpoints nur in rem:** große Fenster über `3xl:` (1700 px) / `4xl:` (1800 px) aus `src/styles/tokens.css`. `min-[…px]:` wird vor `lg:` einsortiert und überschrieben (Muster-Raster zerfiel). `src/ui/breakpoints.test.ts` verbietet Pixel-Breakpoints.
- **Brettgröße nach Fensterhöhe:** `boardSizeFor(reservierteHöhe)` in `src/ui/analyse/boardStyle.ts`; die reservierte Höhe wurde im Browser gemessen (Analyse 400 px, Training 300 px).
- **Keine knappen `max_tokens`:** Modelle mit „Nachdenken“ (z. B. Claude Haiku 5.5 über OpenRouter) verbrauchen das Limit sonst, bevor Text kommt. Fehlercodes `truncated` und `rejected` in `src/llm/client.ts`.
- **Autosave und Bibliothek:** Das automatische Speichern legt die offene Partie bei jeder Änderung in der Bibliothek ab; gelöschte, noch offene Partien sperrt `removedSource` in `src/store/library.ts`.
- **WebKitGTK:** Auswahllisten und Zahlenfelder sind in `src/styles/index.css` selbst gezeichnet (sonst unlesbar). Unter Linux setzt `main.rs` `WEBKIT_DISABLE_DMABUF_RENDERER=1` (NVIDIA + Wayland).
- **Töne unter WebKitGTK:** WebAudio liefert in der WebView nur Stille (am PipeWire-Monitor gemessen), und `<audio>` kann die WebView einfrieren (GStreamer-Deadlock, WebKit beendet dann den Prozess). Töne deshalb in der Desktop-App über Rust dekodieren und abspielen (`src-tauri/src/sound.rs`, rodio/symphonia); `<audio>` nur im Browser-Modus. rodio braucht unter Linux zum Bauen die ALSA-Pakete (`alsa-lib` bzw. `libasound2-dev`, in README und CI eingetragen).
- **react-chessboard:** `squareStyles` landen auf dem inneren Element des Felds. Die Routine für den Ziehbeginn (`onPieceDrag`) erneuert die Bibliothek nur bei geänderter Stellung; Brett-Routinen deshalb den aktuellen Stand aus einer Ref lesen lassen (`TrainingBoard.tsx`). Die englischen dnd-kit-Screenreader-Texte sind per CSS ausgeblendet; die App sagt Züge selbst an.
- **Tests:** jsdom braucht den `getBoundingClientRect`-Stub aus `src/test/setup.ts`; Test-Engine `src/test/fakeEngine.ts`, Test-KI `src/test/fakeLlm.ts` (erkennt deutsche und englische Prompts an ihren Markern); Bibliotheks-Fixture `src/test/libraryFixtures.ts`. Tests mit der nativen Engine werden übersprungen, wenn die Binary fehlt.
- **Lichess:** nur ein Ereignisstrom pro Token (ein neuer schließt den alten), ihn vor der Suche öffnen. Rochaden kommen in der Zugliste auch als König-auf-Turm (`e1h1`). Serverstand ist die Wahrheit, Zeitüberschreitung entscheidet nur der Server. Nach einer Paarung schließt Lichess den Suchstrom oft **vor** `gameStart`; deshalb gibt es in `src/store/play.ts` ein Paarungsfenster und als Rückfall `/api/account/playing` (sonst startet die Partie erst nach „Wiederverbinden“). Anmeldung per OAuth/PKCE ohne App-Registrierung, Scope nur `board:play` (reicht auch für Herausforderungen); der Token liegt im Schlüsselbund und zur Laufzeit nur in `src/store/lichessAuth.ts`. Tests mit dem simulierten Server `src/test/fakeLichess.ts`; Warte-Funktionen in Tests müssen an die Timer abgeben (`setTimeout`), sonst hängt die Neuverbinden-Schleife.
- **pnpm:** `pnpm-workspace.yaml` schaltet das `postinstall` von `stockfish` bewusst ab (`allowBuilds`).
- **Sichtprüfung großer Fenster** im Vorschau-Browser: Viewport per `resize_window` setzen, für Übersichtsbilder `document.documentElement.style.transform = 'scale(…)'` (ändert das Layout nicht), Maße per `getBoundingClientRect` ohne Transform. Testdaten im Vorschau-Speicher danach wieder löschen.

## Release

1. Version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json` und im `schach-coach`-Eintrag von `src-tauri/Cargo.lock` erhöhen; `cargo check --locked` in `src-tauri/`.
2. Committen, pushen, Tag `vX.Y.Z` setzen und pushen → `.github/workflows/build.yml` baut Linux, Windows, macOS (Universal, ad hoc signiert, **experimentell**) und legt einen Release-Entwurf an.
3. Pakete am Entwurf prüfen, zweisprachigen Release-Text setzen (Deutsch, darunter Englisch), mit `gh release edit … --draft=false --latest` veröffentlichen.

## Git

- Die E-Mail für dieses Repository ist die GitHub-noreply-Adresse (`git config user.email`, nur lokal) – die private Adresse darf nicht in die öffentliche Historie.
- `docs/mockups/` (Design-Vorlagen) bleibt lokal und ist in `.gitignore`.

## CLAUDE.md selbst pflegen (gilt dauerhaft)

Diese Datei ist das Gedächtnis des Projekts. Claude Code hält sie ohne Aufforderung aktuell:

- Nach jeder größeren Änderung (Architektur, Entscheidungen, Befehle, Regeln) im selben Commit oder direkt danach („docs: CLAUDE.md aktualisiert“); im Bericht eine Zeile dazu.
- Hinein gehört kurz und konkret: Überblick und Ordner (ein Satz je Bereich), Befehle, Entscheidungen mit Grund, harte Regeln, Konventionen, bekannte Einschränkungen, Verweise auf `README.md` / `THIRD_PARTY_ASSETS.md` statt Kopien.
- Nicht hinein: Geheimnisse, Zwischenstände, Logs, Kurzlebiges, was schon klar im Code steht.
- Schlank halten (unter ca. 250 Zeilen, sonst Details nach `docs/` auslagern). Veraltetes entfernen statt anhängen; keine Widersprüche zu README und Code.
