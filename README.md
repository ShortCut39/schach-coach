# Schach-Coach

Desktop-App für die Analyse eigener Schachpartien: Stockfish bewertet jede Stellung, die App klassifiziert jeden Zug (Brillant bis Patzer), und ein LLM über einen OpenAI-kompatiblen Endpunkt erklärt die wichtigen Züge in einfachem Deutsch – auch die guten.

> **Stand: Meilenstein 0 (Gerüst).** App-Shell mit Navigation und vier leeren Screens. Import, Brett, Engine und KI folgen in den nächsten Meilensteinen.

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
- Nur Deutsch, nur dunkles Farbschema.
- Gebaut und getestet wird vorerst nur unter Linux.

## Lizenzhinweise

- Schriften: IBM Plex (SIL Open Font License), lokal gebündelt über `@fontsource`.
- Beispielpartie `src/test/fixtures/opera-game.pgn`: Morphy – Herzog von Braunschweig & Graf Isouard, Paris 1858 (gemeinfrei).
