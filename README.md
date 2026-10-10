# Schach-Coach

Desktop-App für die Analyse eigener Schachpartien: Stockfish bewertet jede Stellung, die App klassifiziert jeden Zug (Brillant bis Patzer), und ein LLM über einen OpenAI-kompatiblen Endpunkt erklärt die wichtigen Züge in einfachem Deutsch – auch die guten.

> **Stand: Version 3 (in Arbeit).** Partien laden, mit Stockfish 19 bewerten (nativ als Sidecar, sonst WASM), klassifizieren und von einer KI erklären lassen. Dazu gibt es Zusammenfassung mit Tipps, Markdown-Export, Bibliothek, Chat zur Stellung, Import von Lichess und Chess.com und ein helles Farbschema. Dazu **Muster über viele Partien** (typische Fehler, Genauigkeit über die Zeit, Eröffnungen, KI-Trainingsplan). Neu: **Training aus eigenen Fehlern** mit Wiederholung. Noch offen: weitere Sprachen sowie Windows- und macOS-Builds.

## Bedienung

- **Import:** PGN einfügen (Live-Prüfung unter dem Feld), FEN im Tab „FEN“ oder eine `.pgn`-Datei ins Fenster ziehen bzw. auswählen. Enthält der Text mehrere Partien, erscheint rechts eine Auswahlliste. „Du spielst“ legt fest, welche Seite unten steht.
- **Analyse:** Zug in der Liste anklicken oder per Tastatur: **← / →** ein Zug, **Pos1 / Ende** Anfang/Ende, **F** Brett drehen. Ein Klick in den Bewertungsverlauf springt zum Zug.
- **Zusammenfassung:** Rechts im Analyse-Screen der Reiter „Zusammenfassung“ → „Zusammenfassung öffnen“. Sie zeigt Genauigkeit je Phase, Zugkategorien, Wendepunkte (anklickbar), Eröffnung, Bewertungsverlauf und die drei wichtigsten Tipps der KI. „Als Markdown exportieren“ speichert alles samt Zugliste und Erklärungen als `.md`-Datei.
- **Bibliothek:** Jede vollständig bewertete Partie landet automatisch hier, samt Erklärungen, Tipps und Chat. Es gibt Suche nach Eröffnung, Spieler oder Titel, die Filter „Als Weiß“, „Als Schwarz“ und „Niederlagen“ und eine Sortierung. „Öffnen“ lädt die Partie ohne neue Rechnung, Löschen fragt einmal nach. Wird dieselbe Partie erneut mit gleicher Tiefe importiert, übernimmt die App die gespeicherten Bewertungen. Erklärungen übernimmt sie nur, wenn du wieder dieselbe Farbe gewählt hast.
- **Muster über viele Partien:** Bibliothek → Reiter „Muster“, sichtbar ab 3 analysierten Partien.
  - **Typische Fehler:** Jeder eigene Fehler bekommt ein Motiv: Material eingestellt, Drohung übersehen, Schlag verpasst, Matt zugelassen, Matt verpasst oder Sonstiges. Dazu Häufigkeit und anklickbare Beispiele, die die Partie an genau diesem Zug öffnen.
  - **Genauigkeit über die Zeit:** ein Verlauf über deine Partien, der Trend der letzten 5 gegen die davor und die Phasen mit Genauigkeit und Fehlern pro 10 eigene Züge.
  - **Eröffnungen:** Bilanz, Genauigkeit und Theorie-Länge je Eröffnung, getrennt nach deiner Farbe.
  - **Trainingsplan:** Die KI schreibt aus diesen Zahlen und konkreten Beispielen (in Worten) drei Empfehlungen mit je einer Übung. Der Plan wird gespeichert.
  - Die Karte in der Zusammenfassung zeigt das häufigste Muster.
- **Training aus eigenen Fehlern:** Bibliothek → Reiter „Training“. Jede Aufgabe ist die Stellung vor einem deiner Fehler, deine Aufgabe: einen besseren Zug finden.
  - **Welche Fehler:** Einstellungen → Training: „Patzer und Fehler“, „Verpasste Chancen“ und „Ungenauigkeiten“ einzeln an- oder abschaltbar (Standard: die ersten beiden).
  - **Ziehen:** Figur mit der Maus ziehen, oder Figur anklicken und dann das Zielfeld (mögliche Felder werden markiert). Alternativ den Zug eintippen, deutsch oder englisch („Sf3“, „Nf3“, „exd5“, „0-0“, „e7e8=D“). Bei einer Umwandlung fragt die App nach der Figur.
  - **Prüfung:** Richtig ist jeder Zug, der höchstens so viel Gewinnchance kostet wie ein „Ausgezeichnet“-Zug (2 Prozentpunkte). Ist der Zug einer der gespeicherten Engine-Züge, reicht die gespeicherte Analyse; sonst rechnet Stockfish die Stellung danach kurz nach (Tiefe wie in der Analyse, höchstens 18). Danach zeigt die App die beste Antwort des Gegners, was nach deinem Partiezug gedroht hätte, und die gespeicherte KI-Erklärung, falls es eine gibt.
  - **Hilfen:** „Tipp“ zeigt einen Hinweis zum Fehlermotiv, „Figur zeigen“ markiert die Figur des besten Zugs, „Lösung zeigen“ verrät den Zug (zählt als nicht gelöst).
  - **Wiederholung:** Lernkarten-Prinzip mit Fächern. Richtig gelöste Aufgaben kommen nach 1, 3, 7, 14 und 30 Tagen wieder, falsch gelöste sofort und in derselben Sitzung noch einmal. Mit „Figur zeigen“ gelöst bleibt die Aufgabe in ihrem Fach. Eine Sitzung hat höchstens 12 Aufgaben: zuerst fällige Wiederholungen, dann neue (schwerste Fehler der neuesten Partien zuerst). Die Übersicht zeigt, was heute fällig ist.
  - **Muster gezielt üben:** Auf der Muster-Seite startet „Dieses Muster trainieren“ das Training nur mit Aufgaben dieses Motivs.
- **Lichess / Chess.com:** Im Import Plattform wählen und Benutzernamen eingeben → „Partien laden“ holt die letzten 20 Partien (nur normales Schach, keine Varianten). „Du spielst“ wird automatisch auf deine Farbe gestellt. Gesendet wird nur der Benutzername, an die öffentliche Schnittstelle der Plattform.
- **Chat zur Stellung:** Rechter Reiter „Chat“. Jede Frage bekommt automatisch die Engine-Daten der angezeigten Stellung mit (Linien und Figuren in Gefahr in Worten, dazu der letzte Zug). Die KI soll nur damit antworten.
- **Farbschema:** Einstellungen → Darstellung → Dunkel oder Hell.
- **Weitermachen:** Die letzte Partie wird beim Start wiederhergestellt, mit Bewertungen, Erklärungen, Zusammenfassung und Stellung. Gespeichert wird automatisch.
- **Tastatur:** In Reiterleisten wechseln ← / → den Reiter. Der Link „Zum Inhalt springen“ erscheint mit der Tab-Taste ganz oben.
- **Engine:** In der Desktop-App läuft die **native Stockfish 19** als Sidecar, mehrere Prozesse rechnen gleichzeitig verschiedene Stellungen. Fehlt die Binary, nutzt die App automatisch die eingebaute WASM-Version. Unter Einstellungen → Engine gibt es die Wahl „Nativ“ oder „Eingebaut“ und die Threads, also wie viele Stellungen gleichzeitig gerechnet werden (Automatisch = halbe Kernzahl, höchstens 4). Sie startet beim Öffnen der App (Kopfleiste: „Stockfish 19 Lite WASM · Tiefe 20“ mit grünem Punkt). „Analysieren“ lässt jede Stellung bewerten, während du schon durchklicken kannst. Die Engine-Linien zeigen, was vor dem aktuellen Zug am besten war, alle Bewertungen aus Sicht von Weiß.

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

**Fehlermotive** (`src/classification/motifs.ts`, in dieser Reihenfolge):

1. Matt zugelassen: Nach dem Zug setzt der Gegner laut Engine erzwungen matt.
2. Matt verpasst: Der Bestzug hätte erzwungen matt gesetzt.
3. Drohung übersehen: Eine schon vorher gefährdete Figur wird geschlagen.
4. Material eingestellt: Der Zug bringt eine Figur oder einen Bauern in Gefahr, und die beste Antwort schlägt sie.
5. Schlag verpasst: Eine ungedeckte gegnerische Figur hätte geschlagen werden können.
6. Sonstiges.

„In Gefahr“ heißt angegriffen und ungedeckt oder von einer billigeren Figur angegriffen.

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

Die native Stockfish-Engine (offizielles Release `sf_19`, 81 MB, SHA-256-geprüft) lädt `pnpm fetch:engine` nach `src-tauri/binaries/`. `pnpm tauri dev` und `pnpm tauri build` rufen das automatisch auf. Ist die Binary schon da, passiert nichts. Sie liegt nicht im Git.

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
Fachlogik liegt in UI-freien Modulen – `chess/` (PGN/FEN, Notation), `engine/` (Stockfish als Sidecar oder im Web Worker), `classification/` (Gewinnchance, Zugkategorien, Motive), `llm/` (Prompts, Client), `online/` (Lichess/Chess.com) und `training/` (Aufgaben, Zugprüfung, Wiederholung) – die einzeln mit Vitest getestet werden.
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
- **Bibliothek auf der Festplatte:** `~/.local/share/de.schachcoach.desktop/library/` (je Partie eine Metadaten- und eine Datendatei). Im Browser-Modus liegt sie im `localStorage` des Browsers.
- **Online-Import:** Lichess und Chess.com blockieren Anfragen ohne passenden User-Agent. Die App schickt den User-Agent des Tauri-HTTP-Plugins mit, und beide Schnittstellen nehmen ihn an (getestet im Oktober 2026). Ändert eine Plattform ihre Regeln, meldet die App „nicht verwertbar“ oder „nicht erreichbar“.
- **Muster:** Die Motive sind einfache, regelbasierte Näherungen. Kombinationen und positionelle Fehler landen unter „Sonstiges“. Kennzahlen älterer Bibliothekseinträge rechnet die App beim ersten Öffnen der Muster-Seite einmal aus den gespeicherten Bewertungen nach.
- **Training:** Aufgaben entstehen aus den gespeicherten Fehlern der Bibliothek. Wird eine Partie gelöscht, verschwinden ihre Aufgaben. Der Lernstand liegt in den Einstellungen der App (`trainingCards`). Die Zugprüfung vergleicht die gespeicherte Bewertung vor dem Zug mit einer neuen, oft etwas flacheren Rechnung danach; bei Zügen knapp an der 2-Punkte-Grenze kann das Urteil deshalb schwanken. Die englischen Screenreader-Hinweise der Zieh-Bibliothek (dnd-kit) sind ausgeblendet, weil react-chessboard sie nicht übersetzen lässt. Die App sagt Züge stattdessen selbst auf Deutsch an, und das Eingabefeld ist die Alternative zum Ziehen mit der Maus.
- **Chat:** Er braucht eine Engine-Bewertung der angezeigten Stellung. Solange die Engine noch rechnet, ist Senden gesperrt.
- **Kontrast:** Alle Texttöne erreichen in beiden Farbschemata WCAG AA (4,5:1). Dafür wurde das Token „schwach“ auf `#7f8999` aufgehellt (Design: `#6c7686`). Knapp darunter liegen weiterhin das Patzer-Icon (weiß auf `#e0453a`, 4,1:1) und die Brettkoordinaten (3,4:1), beide wie im Design.
- Die Zusammenfassungs-Ansicht und der Reiter „Brett/Zusammenfassung“ werden nicht über einen Neustart gemerkt, die App startet immer auf dem Brett.
- Die Einstellung „Threads“ ist ausgegraut: Die eingebaute Lite-Engine nutzt einen Thread.
- Nur Deutsch.
- Zellen der Zugliste sind wie im Mockup 32 px hoch, also kleiner als die sonst geltenden 44 px. Zur Bedienung gibt es zusätzlich die Tastatur.
- Fehlt einer FEN etwas, ergänzt die App die hinteren Felder mit Standardwerten: Weiß am Zug, keine Rochaderechte.
- Die Eingabe auf dem Import-Screen bleibt beim Wechsel zwischen den Screens erhalten, aber nicht über einen Neustart der App hinweg.
- **Analysedauer** (Beispielpartie, 34 Stellungen, 3 Linien, i7-8700):

  | Engine                                   | Tiefe 16 | Tiefe 20  |
  | ---------------------------------------- | -------- | --------- |
  | Native Stockfish 19, 4 Prozesse parallel | 11 s     | 44 s      |
  | WASM Lite, 1 Prozess                     | –        | ca. 3 min |

  Die native Engine ist außerdem deutlich stärker, weil sie das große Bewertungsnetz nutzt. „Tiefe 20“ ist deshalb bei beiden Engines nicht dasselbe.

- **Warum parallele Prozesse statt vieler Threads:** Bei Suchen mit fester Tiefe macht Stockfish zusätzliche Threads vor allem gründlicher, aber kaum schneller (gemessen: 1 Thread 2,4 s, 11 Threads 3,8 s für Tiefe 18). Mehrere Stellungen gleichzeitig zu rechnen bringt etwa das 3,7-Fache. Jeder native Prozess braucht rund 300 MB Arbeitsspeicher.
- **Bewertungen unterschiedlicher Engines werden nicht vermischt:** Cache und Bibliothek merken sich, welche Engine gerechnet hat. Eine alte Lite-Analyse wird mit der nativen Engine neu berechnet.
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
- **Engine: Stockfish.js 19 (GPL-3.0)**, gebündelt aus dem npm-Paket `stockfish`, und die **native Stockfish 19** (GPL-3.0) aus dem offiziellen Release von github.com/official-stockfish/Stockfish als Sidecar.
- Eröffnungsbuch: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), siehe `data/chess-openings/`. `pnpm build:openings` erzeugt daraus `src/classification/data/openings.json`.
- Test-Fixture `src/test/fixtures/opera-game-evals-d20.json`: echte Stockfish-Bewertungen der Beispielpartie (Tiefe 20, Multi-PV 3), erzeugt mit `GENERATE_EVAL_FIXTURE=1 pnpm vitest run src/test/tools`.
- Beispielpartie `src/test/fixtures/opera-game.pgn`: Morphy – Herzog von Braunschweig & Graf Isouard, Paris 1858 (gemeinfrei).
