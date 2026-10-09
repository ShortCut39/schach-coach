# Schach-Coach

Desktop-App für die Analyse eigener Schachpartien: Stockfish bewertet jede Stellung, die App klassifiziert jeden Zug (Brillant bis Patzer), und ein LLM über einen OpenAI-kompatiblen Endpunkt erklärt die wichtigen Züge in einfachem Deutsch – auch die guten.

> **Stand: Meilenstein 5 (Zusammenfassung und Feinschliff).** Partien laden und mit Stockfish 19 (Lite, WASM) bewerten lassen, jeder Zug wird klassifiziert, ein LLM erklärt die wichtigen Züge. Neu: Zusammenfassung mit Genauigkeit, Wendepunkten und drei KI-Tipps, Markdown-Export, die letzte Partie wird beim Start samt Bewertungen und Erklärungen wiederhergestellt, Fehler- und Leerzustände, Barrierefreiheit und Linux-Pakete (deb, AppImage). Version 2 (Bibliothek, Chat, Lichess/Chess.com-Import, helles Design) folgt in Meilenstein 6.

## Bedienung

- **Import:** PGN einfügen (Live-Prüfung unter dem Feld), FEN im Tab „FEN“ oder eine `.pgn`-Datei ins Fenster ziehen bzw. auswählen. Enthält der Text mehrere Partien, erscheint rechts eine Auswahlliste. „Du spielst“ legt fest, welche Seite unten steht.
- **Analyse:** Zug in der Liste anklicken oder per Tastatur: **← / →** ein Zug, **Pos1 / Ende** Anfang/Ende, **F** Brett drehen. Ein Klick in den Bewertungsverlauf springt zum Zug.
- **Zusammenfassung:** Rechts im Analyse-Screen der Reiter „Zusammenfassung“ → „Zusammenfassung öffnen“. Sie zeigt Genauigkeit je Phase, Zugkategorien, Wendepunkte (anklickbar), Eröffnung, Bewertungsverlauf und die drei wichtigsten Tipps der KI. „Als Markdown exportieren“ speichert alles samt Zugliste und Erklärungen als `.md`-Datei.
- **Weitermachen:** Die letzte Partie wird beim Start wiederhergestellt, mit Bewertungen, Erklärungen, Zusammenfassung und Stellung. Gespeichert wird automatisch.
- **Tastatur:** In Reiterleisten wechseln ← / → den Reiter. Der Link „Zum Inhalt springen“ erscheint mit der Tab-Taste ganz oben.
- **Engine:** Startet beim Öffnen der App (Kopfleiste: „Stockfish 19 Lite WASM · Tiefe 20“ mit grünem Punkt). „Analysieren“ lässt jede Stellung bewerten, während du schon durchklicken kannst. Die Engine-Linien zeigen, was vor dem aktuellen Zug am besten war, alle Bewertungen aus Sicht von Weiß.

## KI einrichten

1. **Einstellungen → KI-Anbindung:** Voreinstellung wählen (OpenAI, OpenRouter, Ollama, LM Studio oder Eigener), dann Base-URL, API-Key und Modellname eintragen. Für Ollama und LM Studio bleibt der Key leer.
2. **„Verbindung testen“** schickt eine Mini-Anfrage und zeigt die Antwortzeit oder einen verständlichen Fehler (Key falsch, Modell unbekannt, nicht erreichbar …).
3. **Speichern.** Danach erklärt die KI nach jeder Engine-Analyse automatisch die ausgewählten Züge („Erklärungen für“ beim Import), in Paketen zu 7 Zügen.

**Der API-Key** liegt im Schlüsselbund des Systems (Secret Service: gnome-keyring oder KWallet), getrennt pro Endpunkt (Origin). Wechselst du die Base-URL, wird ein anderer Key verwendet oder keiner, sodass ein Key nie an einen anderen Server geht. Er steht nicht in der Einstellungsdatei und wird nie geloggt.

**Was das LLM bekommt:** nur Fakten aus Stockfish und chess.js. Das sind Zug, Kategorie, FEN davor und danach, Bestzug, Gewinnchancen, Hauptvariante (höchstens 6 Halbzüge), Materialänderung und Flags (Schach, Matt, Schlag, Opfer). Der System-Prompt verbietet erfundene Züge, Varianten und Bewertungen. Antworten werden mit zod geprüft und bei Bedarf einmal automatisch wiederholt. Lehnt ein Endpunkt `response_format: json_object` ab, fragt die App ohne JSON-Modus erneut.

**„Unbemerkt gut gespielt“:** Spielst du einen großartigen oder brillanten Zug und verlierst in deinen nächsten zwei Zügen mindestens 5 Prozentpunkte Gewinnchance, zeigt der Coach am guten Zug einen Hinweis.

## Wie die Züge eingeteilt werden

Alle Werte sind Gewinnchancen in Prozent aus Sicht des Ziehenden, berechnet aus der Stockfish-Bewertung (`src/classification/`). Chess.com legt seine Regeln nicht offen; die Regeln hier sind Näherungen, alle Schwellen stehen in `DEFAULT_CLASSIFICATION`.

| Kategorie                       | Regel                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theorie                         | Stellung nach dem Zug steht im Lichess-Eröffnungsbuch, und die Partie war bis dahin ununterbrochen im Buch. Gezählt werden nur benannte Buchstellungen.                       |
| Beste                           | gespielter Zug = Engine-Zug 1                                                                                                                                                 |
| Ausgezeichnet / Gut             | Verlust ≤ 2 / < 5                                                                                                                                                             |
| Ungenauigkeit / Fehler / Patzer | Verlust ab 5 / 10 / 20 (später in den Einstellungen änderbar)                                                                                                                 |
| Verpasst                        | Der Gegner hat vorher ≥ 10 verloren, der Bestzug hätte klar gewonnen (≥ 80), und du verlierst ≥ 10.                                                                           |
| Großartig                       | Beste/Ausgezeichnet. Die beste Engine-Alternative (ein anderer Zug) ist ≥ 10 schlechter, und die Stellung war nicht entschieden (zwischen 10 und 90).                         |
| Brillant                        | Beste/Ausgezeichnet mit Figurenopfer (Materialverlust ≥ 3 entlang der Hauptvariante, nicht sofort zurückgewonnen). Danach mindestens 50, und vorher nicht entschieden (< 90). |

**Anpassungen gegenüber dem Projektdokument** (alle mit Tests):

- **Brillant bei Matt:** Mit der wörtlichen Regel wäre 16. Db8+ nie brillant, weil Weiß vorher schon gewinnt (Matt in 2 = 100). Neu gilt deshalb: Führt das Opfer zu einem erzwungenen Matt, während der zweitbeste Zug kein Matt erzwingt, zählt die Stellung nicht als „ohnehin entschieden“. Damit ist 16. Db8+ brillant (Soll-Test mit echten Stockfish-Daten, Tiefe 20).
- **Großartig:** Verglichen wird der gespielte Zug mit der besten Alternative, nicht stur Linie 1 mit Linie 2.
- **Opfer-Schwelle 2 statt 3:** Auf Wunsch gesenkt, damit auch Figur-gegen-Bauer-Opfer wie Lxh7+ zählen.
- **Opfer an der Fenstergrenze:** Die direkte Antwort auf einen gegnerischen Schlagzug wird auch hinter dem 8-Halbzug-Fenster gelesen. Sonst sähe ein Damentausch an der Grenze wie ein Opfer aus.

**Spielphasen** (für die Genauigkeit je Phase, angelehnt an Lichess): Endspiel ab höchstens 6 Figuren ohne Bauern und Könige, Eröffnung bis Zug 10, dazwischen Mittelspiel.

**Genauigkeit** pro Zug: `103,1668 · e^(−0,04354 · Verlust) − 3,1669` (0..100), pro Spieler der Durchschnitt.

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
pnpm tauri build    # Linux-Pakete (deb, AppImage), siehe „Linux-Pakete“
```

## Linux-Pakete

```bash
pnpm tauri build
```

Die Pakete liegen danach unter `src-tauri/target/release/bundle/`:

- `appimage/Schach-Coach_<version>_amd64.AppImage`: direkt startbar (`chmod +x`, dann ausführen).
- `deb/Schach-Coach_<version>_amd64.deb`: für Debian/Ubuntu. Unter Arch lieber das AppImage oder `pnpm tauri dev` nutzen.

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
Zustand liegt in Zustand-Stores (`store/`, inklusive Einstellungen, Sitzung und dem Ablauf Engine → KI), Komponenten liegen unter `ui/` (`shared/` für Bausteine, `screens/` für die vier Screens, `analyse/`, `import/` und `summary/` für deren Teile).
Alle sichtbaren Texte stehen in `src/i18n/de.json` und werden über i18next geladen; die Schlüssel sind typisiert, ein falscher Schlüssel fällt beim Typecheck auf.
Farben, Radien und Schriften sind Design-Tokens als CSS-Variablen in `src/styles/tokens.css` und werden als Tailwind-Klassen (`bg-panel`, `text-muted`, `rounded-panel` …) verwendet.

Design-Vorlagen: `docs/mockups/*.png` (verbindlich), `docs/mockups/html/` (nur Maßreferenz).

## Bekannte Einschränkungen

- **NVIDIA + Wayland:** WebKitGTK stürzt dort sonst mit „Error 71 (Protokollfehler)“ ab. Die App setzt deshalb unter Linux beim Start automatisch `WEBKIT_DISABLE_DMABUF_RENDERER=1`, sofern die Variable nicht schon gesetzt ist (`src-tauri/src/main.rs`).
- **TypeScript 6.0 statt 7:** `typescript-eslint` unterstützt TypeScript 7 noch nicht. Ein Wechsel ist geplant, sobald es unterstützt wird.
- **Content-Security-Policy:** In `src-tauri/tauri.conf.json` ist sie streng gesetzt (nur eigene Dateien, WASM erlaubt, Netzwerk nur über das Tauri-HTTP-Plugin). Der Dev-Modus nutzt eine eigene, lockerere `devCsp` für Vites Hot-Reload. `style-src` ist von Tauris automatischen Nonces ausgenommen, weil React und react-chessboard Inline-Styles nutzen.
- **HTTP-Freigabe:** Die App darf `https://` beliebig sowie `http://localhost` und `http://127.0.0.1` ansprechen (`src-tauri/capabilities/default.json`). Ein LLM-Server im Heimnetz über `http://192.168…` ist damit nicht erreichbar.
- Im Browser-Modus (`pnpm dev` ohne Tauri) gibt es keinen Schlüsselbund: Der Key gilt dort nur bis zum Neuladen. Außerdem können CORS-Regeln Anfragen blockieren.
- Gespeichert wird nur die **letzte** Partie, samt Erklärungen. Mehrere Partien kommen mit der Bibliothek in Meilenstein 6.
- **Kontrast:** Alle Texttöne erreichen WCAG AA (4,5:1) außer dem Token „schwach“ `#6c7686` mit 3,5–4,2:1 (kleine Labels, Zugnummern, Hinweise). Knapp darunter liegen auch das Patzer-Icon (weiß auf `#e0453a`, 4,1:1) und die Brettkoordinaten (3,4:1). Die Werte stammen aus dem Design und sind bewusst nicht geändert.
- Die Zusammenfassungs-Ansicht und der Reiter „Brett/Zusammenfassung“ werden nicht über einen Neustart gemerkt, die App startet immer auf dem Brett.
- Die Einstellung „Threads“ ist ausgegraut: Die eingebaute Lite-Engine nutzt einen Thread.
- Nur Deutsch, nur dunkles Farbschema.
- Zellen der Zugliste sind wie im Mockup 32 px hoch, also kleiner als die sonst geltenden 44 px. Zur Bedienung gibt es zusätzlich die Tastatur.
- Fehlt einer FEN etwas, ergänzt die App die hinteren Felder mit Standardwerten: Weiß am Zug, keine Rochaderechte.
- Die Eingabe auf dem Import-Screen bleibt beim Wechsel zwischen den Screens erhalten, aber nicht über einen Neustart der App hinweg.
- **Analysedauer:** Stockfish läuft als Lite-Version mit nur einem Thread im WebView. Die Beispielpartie (34 Stellungen, Tiefe 20, 3 Linien) dauert etwa 3 Minuten, längere Partien entsprechend länger. Die Tiefe lässt sich beim Import wählen (14 / 20 / 26). Schneller wird es mit dem nativen Stockfish (Version 3).
- **Früher Stopp bei Matt:** Hat die beste Linie ein erzwungenes Matt, endet die Suche, sobald eine Iteration mit mindestens Tiefe `max(10, 2 × Mattlänge + 6)` vollständig ist. Weiteres Rechnen würde nur die Nebenlinien verfeinern und dauert z. B. bei Matt in 1 über eine Minute. Die angezeigte Tiefe ist dann die tatsächlich gerechnete.
- Bewertungen werden nur im Arbeitsspeicher zwischengespeichert, nicht über einen Neustart hinweg.
- Eröffnungsnamen kommen aus dem Lichess-Buch und sind englisch (z. B. „Philidor Defense“).
- Mit geringer Tiefe (z. B. 14) bewertet Stockfish manche Stellungen spürbar anders als mit Tiefe 20. Das ändert auch die Kategorien.
- Gebaut und getestet wird vorerst nur unter Linux.

## Lizenz

Schach-Coach steht unter der **GNU General Public License v3.0 oder später** (siehe `LICENSE`), weil die App Stockfish (GPL-3.0) bündelt.

## Lizenzhinweise

- Schriften: IBM Plex (SIL Open Font License), lokal gebündelt über `@fontsource`.
- Figuren: SVG-Satz aus `react-chessboard` (MIT), im Stil der Cburnett-Figuren von Wikimedia Commons.
- Schachlogik: `chess.js` (BSD-2-Clause).
- **Engine: Stockfish.js 19 (GPL-3.0)**, gebündelt aus dem npm-Paket `stockfish`.
- Eröffnungsbuch: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), siehe `data/chess-openings/`. `pnpm build:openings` erzeugt daraus `src/classification/data/openings.json`.
- Test-Fixture `src/test/fixtures/opera-game-evals-d20.json`: echte Stockfish-Bewertungen der Beispielpartie (Tiefe 20, Multi-PV 3), erzeugt mit `GENERATE_EVAL_FIXTURE=1 pnpm vitest run src/test/tools`.
- Beispielpartie `src/test/fixtures/opera-game.pgn`: Morphy – Herzog von Braunschweig & Graf Isouard, Paris 1858 (gemeinfrei).
