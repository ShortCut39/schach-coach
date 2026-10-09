# Schach-Coach

Desktop-App für die Analyse eigener Schachpartien: Stockfish bewertet jede Stellung, die App klassifiziert jeden Zug (Brillant bis Patzer), und ein LLM über einen OpenAI-kompatiblen Endpunkt erklärt die wichtigen Züge in einfachem Deutsch – auch die guten.

> **Stand: Meilenstein 2 (Engine).** Partien als PGN, FEN oder Datei laden, Brett mit Zugliste und Tastatursteuerung. Stockfish 19 (Lite, WASM) bewertet im Hintergrund jede Stellung mit Multi-PV 3. Dazu gibt es Fortschritt mit Abbrechen und Fortsetzen, einen Cache, Eval-Balken, Bewertungsverlauf und Engine-Linien. Zugkategorien und KI folgen in den nächsten Meilensteinen.

## Bedienung

- **Import:** PGN einfügen (Live-Prüfung unter dem Feld), FEN im Tab „FEN“ oder eine `.pgn`-Datei ins Fenster ziehen bzw. auswählen. Enthält der Text mehrere Partien, erscheint rechts eine Auswahlliste. „Du spielst“ legt fest, welche Seite unten steht.
- **Analyse:** Zug in der Liste anklicken oder per Tastatur: **← / →** ein Zug, **Pos1 / Ende** Anfang/Ende, **F** Brett drehen. Ein Klick in den Bewertungsverlauf springt zum Zug.
- **Engine:** Startet beim Öffnen der App (Kopfleiste: „Stockfish 19 Lite WASM · Tiefe 20“ mit grünem Punkt). „Analysieren“ lässt jede Stellung bewerten, während du schon durchklicken kannst. Die Engine-Linien zeigen, was vor dem aktuellen Zug am besten war, alle Bewertungen aus Sicht von Weiß.

## Setup unter CachyOS / Arch Linux

Systempakete für Tauri 2 (Liste laut [Tauri-Doku](https://v2.tauri.app/start/prerequisites/), Stand Oktober 2026). Unter CachyOS ist `libappindicator-gtk3` durch das Paket `libappindicator` ersetzt. pacman installiert es automatisch.

```bash
sudo pacman -Syu
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

Rust über rustup (Arch-Paket, alternativ das offizielle Skript von rustup.rs):

```bash
sudo pacman -S --needed rustup
rustup default stable
```

Node.js (≥ 22) und pnpm (≥ 10) werden ebenfalls gebraucht:

```bash
sudo pacman -S --needed nodejs pnpm
```

Abhängigkeiten installieren:

```bash
pnpm install
```

Hinweis: `pnpm-workspace.yaml` schaltet das `postinstall`-Skript des Pakets `stockfish` bewusst ab. Es würde nur Verknüpfungen auf die 99-MB-Vollversion anlegen, die App nutzt die Lite-Version.

## Starten

```bash
pnpm tauri dev      # Desktop-App mit Hot-Reload
pnpm dev            # nur das Frontend im Browser (http://localhost:1420)
pnpm tauri build    # Linux-Pakete (deb, AppImage) unter src-tauri/target/release/bundle
```

## Prüfen und Testen

```bash
pnpm typecheck      # TypeScript (strict)
pnpm lint           # ESLint
pnpm test           # Vitest
pnpm format         # Prettier
```

## Architektur

Die App ist ein Tauri-2-Programm: ein schlanker Rust-Teil (`src-tauri/`) öffnet ein Fenster, die gesamte Oberfläche ist React + TypeScript (`src/`).
Fachlogik liegt in UI-freien Modulen – `chess/` (PGN/FEN, Notation), `engine/` (Stockfish im Web Worker), `classification/` (Gewinnchance, Zugkategorien) und `llm/` (Prompts, Client) – die einzeln mit Vitest getestet werden.
Zustand liegt in Zustand-Stores (`store/`), Komponenten liegen unter `ui/` (`shared/` für Bausteine, `screens/` für die vier Screens).
Alle sichtbaren Texte stehen in `src/i18n/de.json` und werden über i18next geladen; die Schlüssel sind typisiert, ein falscher Schlüssel fällt beim Typecheck auf.
Farben, Radien und Schriften sind Design-Tokens als CSS-Variablen in `src/styles/tokens.css` und werden als Tailwind-Klassen (`bg-panel`, `text-muted`, `rounded-panel` …) verwendet.

Design-Vorlagen: `docs/mockups/*.png` (verbindlich), `docs/mockups/html/` (nur Maßreferenz).

## Bekannte Einschränkungen

- **NVIDIA + Wayland:** WebKitGTK stürzt dort sonst mit „Error 71 (Protokollfehler)“ ab. Die App setzt deshalb unter Linux beim Start automatisch `WEBKIT_DISABLE_DMABUF_RENDERER=1`, sofern die Variable nicht schon gesetzt ist (`src-tauri/src/main.rs`).
- **TypeScript 6.0 statt 7:** `typescript-eslint` unterstützt TypeScript 7 noch nicht. Ein Wechsel ist geplant, sobald es unterstützt wird.
- Die Content-Security-Policy (`csp`) ist noch nicht gesetzt. Sie kommt mit der KI-Anbindung in Meilenstein 4.
- Nur Deutsch, nur dunkles Farbschema. Die Notation ist fest auf Deutsch, umschaltbar wird sie mit den Einstellungen in Meilenstein 4.
- Zellen der Zugliste sind wie im Mockup 32 px hoch, also kleiner als die sonst geltenden 44 px. Zur Bedienung gibt es zusätzlich die Tastatur.
- Fehlt einer FEN etwas, ergänzt die App die hinteren Felder mit Standardwerten: Weiß am Zug, keine Rochaderechte.
- Die Eingabe auf dem Import-Screen bleibt beim Wechsel zwischen den Screens erhalten, aber nicht über einen Neustart der App hinweg.
- **Analysedauer:** Stockfish läuft als Lite-Version mit nur einem Thread im WebView. Die Beispielpartie (34 Stellungen, Tiefe 20, 3 Linien) dauert etwa 3 Minuten, längere Partien entsprechend länger. Die Tiefe lässt sich beim Import wählen (14 / 20 / 26). Schneller wird es mit dem nativen Stockfish (Version 3).
- **Früher Stopp bei Matt:** Hat die beste Linie ein erzwungenes Matt, endet die Suche, sobald eine Iteration mit mindestens Tiefe `max(10, 2 × Mattlänge + 6)` vollständig ist. Weiteres Rechnen würde nur die Nebenlinien verfeinern und dauert z. B. bei Matt in 1 über eine Minute. Die angezeigte Tiefe ist dann die tatsächlich gerechnete.
- Bewertungen werden nur im Arbeitsspeicher zwischengespeichert, nicht über einen Neustart hinweg.
- Gebaut und getestet wird vorerst nur unter Linux.

## Lizenzhinweise

- Schriften: IBM Plex (SIL Open Font License), lokal gebündelt über `@fontsource`.
- Figuren: SVG-Satz aus `react-chessboard` (MIT), im Stil der Cburnett-Figuren von Wikimedia Commons.
- Schachlogik: `chess.js` (BSD-2-Clause).
- **Engine: Stockfish.js 19 (GPL-3.0)**, gebündelt aus dem npm-Paket `stockfish`. Wer die App mit Stockfish weitergibt, muss die GPL-3.0 einhalten (Quelltext mitliefern, GPL-kompatible Lizenz).
- Beispielpartie `src/test/fixtures/opera-game.pgn`: Morphy – Herzog von Braunschweig & Graf Isouard, Paris 1858 (gemeinfrei).
