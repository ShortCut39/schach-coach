# Schach-Coach

**Deutsch** · [English](README.en.md)

Desktop-App für die Analyse eigener Schachpartien: Stockfish bewertet jede Stellung, die App klassifiziert jeden Zug (Brillant bis Patzer), und ein LLM über einen OpenAI-kompatiblen Endpunkt erklärt die wichtigen Züge in einfachen Worten, auf Deutsch oder Englisch – auch die guten.

> **Stand: Version 3.** Partien laden, mit Stockfish 19 bewerten (nativ als Sidecar, sonst WASM), klassifizieren und von einer KI erklären lassen. Dazu gibt es Zusammenfassung mit Tipps, Markdown-Export, Bibliothek, Chat zur Stellung, Import von Lichess und Chess.com und ein helles Farbschema. Dazu **Muster über viele Partien** (typische Fehler, Genauigkeit über die Zeit, Eröffnungen, KI-Trainingsplan). Dazu **Training aus eigenen Fehlern** mit Wiederholung. Dazu **Englisch** für Oberfläche und KI-Erklärungen. Dazu **Pakete für Windows und macOS** (macOS experimentell), gebaut von GitHub Actions. Dazu **Spielen** – lokal gegen Stockfish mit Lern-Hilfen oder live auf Lichess (ohne jede Hilfe), danach mit einem Klick analysieren. Neu: **Aussehen anpassen** – Figuren, Brett und Töne wählen oder eigene hochladen.

## Download

Fertige Pakete für Linux (AppImage, deb), Windows (Installationsprogramm) und macOS (DMG, experimentell) gibt es unter [Releases](https://github.com/ShortCut39/schach-coach/releases). Hinweise zur ersten Ausführung unter Windows und macOS stehen im Abschnitt [Windows und macOS](#windows-und-macos).

## Bedienung

- **Import:** PGN einfügen (Live-Prüfung unter dem Feld), FEN im Tab „FEN“ oder eine `.pgn`-Datei ins Fenster ziehen bzw. auswählen. Enthält der Text mehrere Partien, erscheint rechts eine Auswahlliste. „Du spielst“ legt fest, welche Seite unten steht.
- **Analyse:** Zug in der Liste anklicken oder per Tastatur: **← / →** ein Zug, **Pos1 / Ende** Anfang/Ende, **F** Brett drehen. Ein Klick in den Bewertungsverlauf springt zum Zug.
- **Zusammenfassung:** Rechts im Analyse-Screen der Reiter „Zusammenfassung“ → „Zusammenfassung öffnen“. Sie zeigt Genauigkeit je Phase, Zugkategorien, Wendepunkte (anklickbar), Eröffnung, Bewertungsverlauf und die drei wichtigsten Tipps der KI. „Als Markdown exportieren“ speichert alles samt Zugliste und Erklärungen als `.md`-Datei.
- **Bibliothek:** Jede vollständig bewertete Partie landet automatisch hier (gespielte Partien schon vorher, als „nicht analysiert“), samt Erklärungen, Tipps und Chat. Es gibt Suche nach Eröffnung, Spieler oder Titel, die Filter „Als Weiß“, „Als Schwarz“ und „Niederlagen“ und eine Sortierung. „Öffnen“ lädt die Partie ohne neue Rechnung, Löschen fragt einmal nach. Wird dieselbe Partie erneut mit gleicher Tiefe importiert, übernimmt die App die gespeicherten Bewertungen. Erklärungen übernimmt sie nur, wenn du wieder dieselbe Farbe gewählt hast.
- **Muster über viele Partien:** Bibliothek → Reiter „Muster“, sichtbar ab 3 analysierten Partien.
  - **Typische Fehler:** Jeder eigene Fehler bekommt ein Motiv: Material eingestellt, Drohung übersehen, Schlag verpasst, Matt zugelassen, Matt verpasst oder Sonstiges. Dazu Häufigkeit und anklickbare Beispiele, die die Partie an genau diesem Zug öffnen.
  - **Genauigkeit über die Zeit:** ein Verlauf über deine Partien, der Trend der letzten 5 gegen die davor und die Phasen mit Genauigkeit und Fehlern pro 10 eigene Züge.
  - **Eröffnungen:** Bilanz, Genauigkeit und Theorie-Länge je Eröffnung, getrennt nach deiner Farbe.
  - **Trainingsplan:** Die KI schreibt aus diesen Zahlen und konkreten Beispielen (in Worten) drei Empfehlungen mit je einer Übung. Der Plan wird gespeichert.
  - Die Karte in der Zusammenfassung zeigt das häufigste Muster.
- **Training aus eigenen Fehlern:** Bibliothek → Reiter „Training“. Jede Aufgabe ist die Stellung vor einem deiner Fehler, deine Aufgabe: einen besseren Zug finden.
  - **Welche Fehler:** Einstellungen → Training: „Patzer und Fehler“, „Verpasste Chancen“ und „Ungenauigkeiten“ einzeln an- oder abschaltbar (Standard: die ersten beiden).
  - **Ziehen:** Figur mit der Maus ziehen, oder Figur anklicken und dann das Zielfeld. Sobald du eine eigene Figur anfasst oder anklickst, zeigen Punkte die möglichen Felder (Ringe, wo geschlagen wird). Rochade: König zwei Felder zur Seite oder auf den eigenen Turm ziehen bzw. klicken. Alternativ den Zug eintippen, deutsch oder englisch („Sf3“, „Nf3“, „exd5“, „0-0“, „e7e8=D“). Bei einer Umwandlung fragt die App nach der Figur.
  - **Prüfung:** Richtig ist jeder Zug, der höchstens so viel Gewinnchance kostet wie ein „Ausgezeichnet“-Zug (2 Prozentpunkte). Ist der Zug einer der gespeicherten Engine-Züge, reicht die gespeicherte Analyse; sonst rechnet Stockfish die Stellung danach kurz nach (Tiefe wie in der Analyse, höchstens 18). Danach zeigt die App die beste Antwort des Gegners, was nach deinem Partiezug gedroht hätte, und die gespeicherte KI-Erklärung, falls es eine gibt.
  - **KI-Erklärung:** Ist die KI eingerichtet, erklärt sie nach jeder gelösten Aufgabe (auch nach „Lösung zeigen“) automatisch, warum der bessere Zug besser ist als dein Partiezug. Sie bekommt nur Daten von Stockfish und chess.js: Bestzug und Partiezug in Worten, jeweils mit der Folge laut Engine, dazu die Figuren in Gefahr und das Fehlermotiv. Hast du einen anderen guten Zug gefunden, wird der mit erklärt. Die Erklärung zum Bestzug wird gespeichert (`trainingExplanations`), bei der Wiederholung wird also nicht erneut gefragt. Ohne KI zeigt die App die gespeicherte Erklärung aus der Analyse, falls es eine gibt.
  - **Hilfen:** „Tipp“ zeigt einen Hinweis zum Fehlermotiv, „Figur zeigen“ markiert die Figur des besten Zugs, „Lösung zeigen“ verrät den Zug (zählt als nicht gelöst).
  - **Wiederholung:** Lernkarten-Prinzip mit Fächern. Richtig gelöste Aufgaben kommen nach 1, 3, 7, 14 und 30 Tagen wieder, falsch gelöste sofort und in derselben Sitzung noch einmal. Mit „Figur zeigen“ gelöst bleibt die Aufgabe in ihrem Fach. Eine Sitzung hat höchstens 12 Aufgaben: zuerst fällige Wiederholungen, dann neue (schwerste Fehler der neuesten Partien zuerst). Die Übersicht zeigt, was heute fällig ist.
  - **Muster gezielt üben:** Auf der Muster-Seite startet „Dieses Muster trainieren“ das Training nur mit Aufgaben dieses Motivs.
- **Lichess / Chess.com:** Im Import Plattform wählen und Benutzernamen eingeben → „Partien laden“ holt die letzten 20 Partien (nur normales Schach, keine Varianten). „Du spielst“ wird automatisch auf deine Farbe gestellt. Gesendet wird nur der Benutzername, an die öffentliche Schnittstelle der Plattform.
- **Chat zur Stellung:** Rechter Reiter „Chat“. Jede Frage bekommt automatisch die Engine-Daten der angezeigten Stellung mit (Linien und Figuren in Gefahr in Worten, dazu der letzte Zug). Die KI soll nur damit antworten.
- **Pfeile und Kreise zum Planen:** Wie bei Lichess auf jedem Brett (Spielen, Analyse, Training). Mit der rechten Maustaste von Feld zu Feld ziehen zeichnet einen Pfeil, ein Rechtsklick auf ein Feld einen Kreis; nochmal dasselbe nimmt ihn wieder weg. Farben: grün, mit Umschalt rot, mit Strg blau, mit Alt gelb (unter KDE verschiebt Alt+Ziehen oft das Fenster). Ein Linksklick aufs Brett oder ein neuer Zug löscht alles. Das ist nur eine Zeichnung ohne Engine und deshalb auch in Live-Partien auf Lichess erlaubt.
- **Farbschema:** Einstellungen → Oberfläche & Sprache → Dunkel oder Hell.
- **Sprache:** Einstellungen → Oberfläche & Sprache → Deutsch oder English. Die Sprache gilt für Oberfläche, Zahlen- und Datumsformat und die KI-Erklärungen. Beim Umschalten wechselt die Notation mit (D/T/L/S ↔ Q/R/B/N), danach ist sie weiter frei einstellbar.
- **Große Fenster:** Das Brett in Analyse und Training wächst mit der Fensterhöhe (bei 1440p etwa doppelt so groß), die Spalten daneben werden breiter, und alles steht mittig. Bibliothek, Muster und Zusammenfassung nutzen bis zu 1800 px Breite; die Muster-Karten stehen dann zu dritt nebeneinander.
- **Weitermachen:** Die letzte Partie wird beim Start wiederhergestellt, mit Bewertungen, Erklärungen, Zusammenfassung und Stellung. Gespeichert wird automatisch.
- **Tastatur:** In Reiterleisten wechseln ← / → den Reiter. Der Link „Zum Inhalt springen“ erscheint mit der Tab-Taste ganz oben.
- **Engine:** In der Desktop-App läuft die **native Stockfish 19** als Sidecar, mehrere Prozesse rechnen gleichzeitig verschiedene Stellungen. Fehlt die Binary, nutzt die App automatisch die eingebaute WASM-Version. Unter Einstellungen → Engine gibt es die Wahl „Nativ“ oder „Eingebaut“ und die Threads, also wie viele Stellungen gleichzeitig gerechnet werden (Automatisch = halbe Kernzahl, höchstens 4). Sie startet beim Öffnen der App (Kopfleiste: „Stockfish 19 Lite WASM · Tiefe 20“ mit grünem Punkt). „Analysieren“ lässt jede Stellung bewerten, während du schon durchklicken kannst. Die Engine-Linien zeigen, was vor dem aktuellen Zug am besten war, alle Bewertungen aus Sicht von Weiß.

## Spielen und Lichess

Im Bereich **Spielen** spielst du lokal gegen Stockfish oder live gegen Menschen auf Lichess. Jede Partie lässt sich danach mit einem Klick analysieren.

- **Gegen Stockfish:** Bedenkzeit (10+0, 10+5, 15+10, eigene Zeit oder ohne Uhr), Farbe (Weiß, Zufall, Schwarz) und Stärke (Anfänger, Leicht, Mittel, Stark, Maximal). Der Gegner ist eine eigene Engine-Instanz, getrennt von der Analyse. Seine Bedenkzeit richtet sich nach der Restzeit (Restzeit / 30 plus 80 % des Inkrements, je Stufe gedeckelt), dazu kommt eine kurze künstliche Pause, damit Züge nicht sofort erscheinen. Läuft deine Zeit ab, ist die Partie verloren, außer der Gegner hat kein Mattmaterial mehr (dann Remis).
  - **Hilfen** (nur hier): „Tipp“ zeigt den besten Zug als Pfeil (gerechnet von der Analyse-Engine, die Zahl der Tipps steht in der Ergebniskarte), „Zug zurücknehmen“ nimmt deinen Zug und die Antwort zurück (die Uhr bekommt keine Zeit zurück), der Bewertungsbalken ist ein- und ausschaltbar (Standard aus).
  - **Remis:** Stockfish nimmt an, wenn er selbst höchstens leicht besser steht (≤ +0,30), und bietet selbst keins an. Ein neues Angebot geht frühestens drei Züge später.
  - **Stärkestufen sind ungefähre Werte, keine geprüften Elo-Zahlen.** Anfänger und Leicht nutzen `Skill Level` mit Tiefen- und Zeitgrenzen, Mittel und Stark `UCI_LimitStrength` mit `UCI_Elo` 1500 bzw. 2000 (Stockfish 19 erlaubt erst ab 1320), Maximal volle Stärke. Geprüft ist nur die Reihenfolge: In Partien der Engine gegen sich selbst gewann die jeweils höhere Stufe die Mehrheit.
- **Lichess:** Anmelden unter Einstellungen → Lichess.
  - **Anmeldung:** per Browser (OAuth 2 mit PKCE, ohne Client-Secret, Rückleitung an einen kleinen Empfänger auf `127.0.0.1` mit zufälligem Port) oder mit einem persönlichen Token, das du auf Lichess erzeugst. Nötig ist nur die Berechtigung `board:play`. Sie genügt laut Lichess-Quellcode auch für Herausforderungen.
  - **Token:** liegt im Schlüsselbund des Systems, geht nur an `https://lichess.org` (die Adresse ist im Code fest) und erscheint in keinem Log und keiner Fehlermeldung. „Abmelden“ löscht ihn und widerruft ihn bei Lichess (`DELETE /api/token`).
  - **Gegner suchen:** offene Suche über die Board-API, gewertet oder ungewertet. Lichess erlaubt das nur ab Rapid (Grundzeit + 40 × Inkrement mindestens 8 Minuten), die App zeigt das vorher an. „Suche abbrechen“ schließt die Verbindung, Lichess löscht die Suche dann.
  - **Freund herausfordern** per Benutzername, hier ist auch Blitz erlaubt (ganze Minuten, 0–60 s Inkrement). Eingehende Herausforderungen erscheinen im Lichess-Dialog zum Annehmen oder Ablehnen.
  - **Während der Partie:** Die Uhr kommt vom Server, ob die Zeit abgelaufen ist, entscheidet nur Lichess. Dazu Aufgeben (mit Rückfrage), Remis anbieten und annehmen, Abbrechen (bis jede Seite einmal gezogen hat) und „Rücknahme anfragen“ (Lichess fragt den Gegner). Verlässt der Gegner die Partie, kannst du nach Ablauf der Wartezeit Sieg oder Remis beanspruchen. Ein einfacher Chat mit dem Gegner ist abschaltbar. Reißt die Verbindung ab, verbindet die App selbst neu. Laufende Partien bietet sie nach einem Neustart zum Fortsetzen an.
- **Fair Play:** Lichess verbietet in Live-Partien jede Hilfe, also Engine, Eröffnungsbuch, Endspieltabellen und fremde Tipps, auch für Drittanbieter-Programme. Deshalb gilt ab dem Partiestart eine zentrale Sperre (`src/play/liveGuard.ts`):
  - Die Analyse-Engines werden beendet, nicht nur ausgeblendet.
  - Keine Engine startet, auch nicht für andere Partien.
  - Die KI ist gesperrt, laufende Anfragen werden abgebrochen.
  - Bewertung, Kategorien, Engine-Pfeile und Coach gibt es nicht, Analyse und Training zeigen nur einen Hinweis. Eigene Pfeile per Rechtsklick gehen weiter.
  - Tests belegen das. Nach Partieende ist alles wieder da. Die App nutzt nur offiziell dokumentierte Endpunkte der Lichess-API, kein Scraping und keine Automatisierung der Webseite.
- **Nach der Partie:** Die Ergebniskarte zeigt Ergebnis mit Grund, Zugzahl und Bedenkzeit. Jede Partie (außer abgebrochenen) landet sofort als „nicht analysiert“ in der Bibliothek. „Partie analysieren“ übergibt sie aus deiner Sicht an die Analyse, die Einstellung „Nach der Partie automatisch analysieren“ (Standard aus) macht das von selbst. Das PGN enthält Event, Site (bei Lichess der Link zur Partie), Datum, Spieler, Ergebnis, Wertungen, Zeitkontrolle und das Partieende. Lokal heißt der Gegner „Stockfish (Stufe …)“.
- **Material:** Neben jedem Namen stehen die Figuren, die diese Seite geschlagen hat (im gewählten Figurensatz), und bei Materialvorteil „+N“ in Bauerneinheiten, wie bei Lichess. Gezählt wird nur aus den Zügen, ohne Engine, deshalb auch in Live-Partien.
- **Töne:** Zug, Schlagen, Rochade, Schach, Umwandlung, Partiebeginn, Partieende (Sieg, Niederlage, Remis) und knappe Zeit. Standard ist das frei lizenzierte Set „SFX“ von Lichess; dazu gibt es weitere freie Sets und „Einfach (synthetisch)“ (von der App selbst berechnet). In der Desktop-App dekodiert und spielt sie der Rust-Teil (rodio/symphonia), weil Audio in der Linux-WebView entweder stumm blieb (WebAudio) oder die App einfrieren konnte (`<audio>`). Unter Einstellungen → Spielen gibt es „Töne“, „Lautstärke“ und „Ton testen“.

## Aussehen anpassen

Unter **Einstellungen → Darstellung** wählst du Figuren, Brett und Töne für alle Bretter der App (Spielen, Analyse, Training). Die Vorschau oben zeigt deine Auswahl sofort, mit einer Stellung aus der Opera-Partie samt Schach. Übernommen wird sie wie alle Einstellungen erst mit **„Speichern“** ganz unten. „Ton testen“ spielt Zug, Schlagzug, Schach und Partieende. Hochladen, Umbenennen und Löschen eigener Sätze wirken dagegen sofort.

- **Voreinstellungen:**
  - Figuren: cburnett (Standard, wie bei Lichess), Merida, Chessnut, RhosGFX, Fantasy, Pixel.
  - Brett: App-Standard, Holz, Salbei sowie Farbpaare im Lichess-Stil (braun, blau, grün, grau, lila). Koordinaten lassen sich abschalten.
  - Töne: SFX (Standard), Piano, NES, Futuristic und „Einfach (synthetisch)“.
  - „Zurücksetzen auf Standard“ gibt es pro Bereich.
- **Eigene Figuren:** 12 Dateien (SVG, PNG oder WebP, je höchstens 2 MB), auch als ZIP-Archiv (höchstens 64 Einträge und 10 MB entpackt, Pfade im Archiv werden ignoriert).
  - Namen wie `wK.svg`, `white_king.png`, `WhiteKing.png` oder `weisser_koenig.svg` werden automatisch zugeordnet, der Rest per Klick.
  - Empfohlen: quadratisch, mindestens 128 × 128 px, transparenter Hintergrund.
- **Eigenes Brett:** zwei Farben (Farbwähler oder Hex-Code, mit Warnung bei zu wenig Kontrast) oder ein quadratisches Brettbild (PNG, JPG, WebP oder SVG, höchstens 5 MB).
  - Nicht quadratische Bilder lassen sich mittig zuschneiden.
  - Letzter Zug, mögliche Züge und Schach liegen immer darüber.
- **Eigene Töne:** ein Platz je Ereignis (Zug, Schlagzug, Rochade, Schach, Umwandlung, Partiebeginn, Partieende, Sieg, Niederlage, Remis, wenig Zeit).
  - Formate: MP3, OGG, WAV oder FLAC, je höchstens 2 MB und 5 Sekunden.
  - Jede Datei wird beim Hochladen probeweise dekodiert. Lässt sie sich nicht abspielen, sagt die App das (Tipp: WAV oder OGG).
  - Freie Plätze nutzen die Töne von SFX, ein Set darf also auch aus einem einzigen Ton bestehen.
  - Dateinamen wie `move.ogg`, `Capture.mp3` (Lichess-Namen) oder `schach.wav` werden automatisch zugeordnet.
- **Grenzen und Sicherheit:**
  - Höchstens 20 eigene Sätze je Bereich.
  - Geprüft wird der Inhalt (Magic Bytes), nicht die Endung.
  - SVGs mit Skripten, `<foreignObject>` oder externen Verweisen werden abgelehnt und auch sonst nur als Bild angezeigt.
  - Nichts wird hochgeladen oder weitergegeben.
  - Fehlt ein gewählter Satz oder ist er beschädigt, nutzt die App den Standard und sagt es einmal.
- **Speicherort:** Eigene Sätze liegen im App-Datenordner im Unterordner `appearance`. Dort lassen sie sich mitsichern, und sie überstehen Updates.
  - Linux: `~/.local/share/de.schachcoach.desktop/`
  - Windows: `%APPDATA%\de.schachcoach.desktop\`
  - macOS: `~/Library/Application Support/de.schachcoach.desktop/`
- **Lichess-Standardtöne nur für dich:** Die bekannten Standardtöne von Lichess (`public/sound/standard` im [Lichess-Quellcode](https://github.com/lichess-org/lila)) sind nicht frei lizenziert und deshalb nicht in der App.
  - Du kannst sie selbst herunterladen (z. B. `Move.ogg`, `Capture.ogg`, `Check.ogg`, `GenericNotify.ogg`, `Victory.ogg`, `Defeat.ogg`, `Draw.ogg`, `LowTime.ogg`) und unter „Töne → Eigenen Satz hinzufügen“ auf einmal hineinziehen. Die Namen werden automatisch zugeordnet.
  - Im Lichess-Quellcode sind manche dieser Dateien nur Verweise: `Victory`, `Defeat` und `Draw` zeigen auf `GenericNotify`, `Check` auf Stille (Lichess hat keinen eigenen Schach-Ton). Je nach Download kommen sie als winzige Textdateien an. Die App übernimmt dann die Zieldatei, wenn sie mit dabei ist. Für Schach bleibt der Ton aus SFX.
  - Diese Dateien sind nur für deinen eigenen Gebrauch. Gib sie nicht weiter, weder einzeln noch in einer veränderten App.
- Lade nur Dateien hoch, die du verwenden darfst. Mitgelieferte Sätze mit Autor, Lizenz und Quelle stehen in [`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md) und in der App unter „Lizenzen und Quellen“.

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
| Ungenauigkeit / Fehler / Patzer | Verlust ab 5 / 10 / 20 (in den Einstellungen änderbar)                                                                                                                        |
| Verpasst                        | Der Gegner hat vorher ≥ 10 verloren, der Bestzug hätte klar gewonnen (≥ 80), und du verlierst ≥ 10.                                                                           |
| Großartig                       | Beste/Ausgezeichnet. Die beste Engine-Alternative (ein anderer Zug) ist ≥ 10 schlechter, und die Stellung war nicht entschieden (zwischen 10 und 90).                         |
| Brillant                        | Beste/Ausgezeichnet mit Figurenopfer (Materialverlust ≥ 2 entlang der Hauptvariante, nicht sofort zurückgewonnen). Danach mindestens 50, und vorher nicht entschieden (< 90). |

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
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool alsa-lib
```

`alsa-lib` braucht der Rust-Teil für die Spieltöne (Bibliothek rodio).

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

## Windows und macOS

Pakete für alle drei Systeme baut GitHub Actions (`.github/workflows/build.yml`), denn eine macOS-App lässt sich nur auf einem Mac bauen und ein Windows-Installer nur sinnvoll unter Windows.

> **macOS ist experimentell.** Das Paket wird gebaut und signiert (ad hoc), wurde aber noch auf keinem Mac ausprobiert. Linux und Windows sind getestet. Wer es auf einem Mac testet: Rückmeldungen sind willkommen.

- **Bauen:** auf GitHub im Reiter „Actions“ → „Build“ → „Run workflow“. Nach etwa 15–25 Minuten liegen die Pakete unten am Lauf unter „Artifacts“. Ein Git-Tag wie `v0.1.0` baut zusätzlich einen Release-Entwurf mit allen Paketen.
- **Windows** (`Schach-Coach_<version>_x64-setup.exe`): Das Installationsprogramm installiert nur für den aktuellen Benutzer und braucht keine Administratorrechte. Weil das Paket nicht signiert ist, zeigt Windows beim ersten Start „Der Computer wurde durch Windows geschützt“: auf „Weitere Informationen“ → „Trotzdem ausführen“.
- **macOS, experimentell** (`Schach-Coach_<version>_universal.dmg`, für Apple Silicon und Intel, ab macOS 11): App aus dem DMG in „Programme“ ziehen. Die App ist nur ad hoc signiert (kein Apple-Entwicklerkonto). Beim ersten Öffnen meldet macOS deshalb, dass der Entwickler nicht überprüft werden kann. Dann: Systemeinstellungen → Datenschutz & Sicherheit → „Dennoch öffnen“. Bei älteren macOS-Versionen geht auch Rechtsklick auf die App → „Öffnen“.
- **Engine:** Jedes Paket enthält die offizielle Stockfish-19-Binary für sein System (`pnpm fetch:engine --target <triple>`, Prüfsummen fest im Skript). Unter macOS ist das die Universal-Binary für beide Prozessor-Typen.
- **Schlüsselbund:** Der API-Key liegt unter Windows in der Anmeldeinformationsverwaltung, unter macOS im Schlüsselbund, je Endpunkt getrennt wie unter Linux.
- **Daten:** Einstellungen und Bibliothek liegen im üblichen App-Datenordner des Systems, unter Windows in `%APPDATA%\de.schachcoach.desktop`, unter macOS in `~/Library/Application Support/de.schachcoach.desktop`.

## Prüfen und Testen

```bash
pnpm typecheck      # TypeScript (strict)
pnpm lint           # ESLint
pnpm test           # Vitest
pnpm format         # Prettier
```

## Architektur

Die App ist ein Tauri-2-Programm: ein schlanker Rust-Teil (`src-tauri/`) öffnet ein Fenster, die gesamte Oberfläche ist React + TypeScript (`src/`).
Fachlogik liegt in UI-freien Modulen – `chess/` (PGN/FEN, Notation), `engine/` (Stockfish als Sidecar oder im Web Worker), `classification/` (Gewinnchance, Zugkategorien, Motive), `llm/` (Prompts, Client), `online/` (Lichess/Chess.com), `training/` (Aufgaben, Zugprüfung, Wiederholung), `play/` (Spielen, Lichess) und `appearance/` (Figuren, Brett, Töne, Prüfung eigener Dateien) – die einzeln mit Vitest getestet werden.
Zustand liegt in Zustand-Stores (`store/`, inklusive Einstellungen, Sitzung und dem Ablauf Engine → KI), Komponenten liegen unter `ui/` (`shared/` für Bausteine, `screens/` für die vier Screens, `analyse/`, `import/` und `summary/` für deren Teile).
Alle sichtbaren Texte stehen in `src/i18n/de.json` und `src/i18n/en.json` und werden über i18next geladen. Die Schlüssel sind typisiert: Ein falscher Schlüssel oder ein fehlender englischer Text fällt beim Typecheck auf, ein Test prüft zusätzlich gleiche Schlüssel und Platzhalter in beiden Sprachen. Die KI-Texte (Prompts und die Zugbeschreibungen in Worten aus `llm/describe.ts`) gibt es ebenfalls in beiden Sprachen; die Feldnamen der Daten bleiben deutsch, damit gespeicherte Analysen gültig bleiben, und der englische Prompt erklärt sie. Eine weitere Sprache braucht eine JSON-Datei, einen Eintrag in `src/i18n/index.ts` und die KI-Texte in `src/llm/`.
Farben, Radien und Schriften sind Design-Tokens als CSS-Variablen in `src/styles/tokens.css` und werden als Tailwind-Klassen (`bg-panel`, `text-muted`, `rounded-panel` …) verwendet.

Design-Vorlagen: `docs/mockups/` (nur lokal, nicht im Repository).

## Bekannte Einschränkungen

- **Grafikbeschleunigung unter Linux:** Die App zeichnet mit der GPU (DMABUF-Renderer von WebKitGTK). Mit NVIDIA unter Wayland brach WebKitGTK früher mit „Error 71 (Protokollfehler)“ ab; die App setzt deshalb `__NV_DISABLE_EXPLICIT_SYNC=1`. Stürzt ein Start trotzdem ab, schaltet der nächste Start automatisch dauerhaft auf den sicheren Modus ohne GPU (`WEBKIT_DISABLE_DMABUF_RENDERER=1`, langsamer). Neu versuchen: die Datei `render-safe-mode` im App-Datenordner löschen (`~/.local/share/de.schachcoach.desktop/`). Selbst gesetzte Umgebungsvariablen haben Vorrang (`src-tauri/src/render.rs`).
- **TypeScript 6.0 statt 7:** `typescript-eslint` unterstützt TypeScript 7 noch nicht. Ein Wechsel ist geplant, sobald es unterstützt wird.
- **Content-Security-Policy:** In `src-tauri/tauri.conf.json` ist sie streng gesetzt (nur eigene Dateien, WASM erlaubt, Netzwerk nur über das Tauri-HTTP-Plugin). Der Dev-Modus nutzt eine eigene, lockerere `devCsp` für Vites Hot-Reload. `style-src` ist von Tauris automatischen Nonces ausgenommen, weil React und react-chessboard Inline-Styles nutzen.
- **HTTP-Freigabe:** Die App darf `https://` beliebig sowie `http://localhost` und `http://127.0.0.1` ansprechen (`src-tauri/capabilities/default.json`). Ein LLM-Server im Heimnetz über `http://192.168…` ist damit nicht erreichbar. Die Freigabe für beliebige `https://`-Adressen braucht die KI-Anbindung. Den Lichess-Token schickt die App trotzdem nur an `https://lichess.org`, weil die Adresse im Lichess-Client fest ist.
- Im Browser-Modus (`pnpm dev` ohne Tauri) gibt es keinen Schlüsselbund: Der Key gilt dort nur bis zum Neuladen. Außerdem können CORS-Regeln Anfragen blockieren.
- **Bibliothek auf der Festplatte:** unter Linux `~/.local/share/de.schachcoach.desktop/library/` (je Partie eine Metadaten- und eine Datendatei; Windows und macOS siehe oben). Im Browser-Modus liegt sie im `localStorage` des Browsers.
- **Online-Import:** Lichess und Chess.com blockieren Anfragen ohne passenden User-Agent. Die App schickt den User-Agent des Tauri-HTTP-Plugins mit, und beide Schnittstellen nehmen ihn an (getestet im Oktober 2026). Ändert eine Plattform ihre Regeln, meldet die App „nicht verwertbar“ oder „nicht erreichbar“.
- **Muster:** Die Motive sind einfache, regelbasierte Näherungen. Kombinationen und positionelle Fehler landen unter „Sonstiges“. Kennzahlen älterer Bibliothekseinträge rechnet die App beim ersten Öffnen der Muster-Seite einmal aus den gespeicherten Bewertungen nach.
- **Training:** Aufgaben entstehen aus den gespeicherten Fehlern der Bibliothek. Wird eine Partie gelöscht, verschwinden ihre Aufgaben. Der Lernstand liegt in den Einstellungen der App (`trainingCards`). Die Zugprüfung vergleicht die gespeicherte Bewertung vor dem Zug mit einer neuen, oft etwas flacheren Rechnung danach; bei Zügen knapp an der 2-Punkte-Grenze kann das Urteil deshalb schwanken. Die englischen Screenreader-Hinweise der Zieh-Bibliothek (dnd-kit) sind ausgeblendet, weil react-chessboard sie nicht übersetzen lässt. Die App sagt Züge stattdessen selbst in der eingestellten Sprache an, und das Eingabefeld ist die Alternative zum Ziehen mit der Maus.
- **Chat:** Er braucht eine Engine-Bewertung der angezeigten Stellung. Solange die Engine noch rechnet, ist Senden gesperrt.
- **Kontrast:** Alle Texttöne erreichen in beiden Farbschemata WCAG AA (4,5:1). Dafür wurde das Token „schwach“ auf `#7f8999` aufgehellt (Design: `#6c7686`). Knapp darunter liegen weiterhin das Patzer-Icon (weiß auf `#e0453a`, 4,1:1) und die Brettkoordinaten (3,4:1), beide wie im Design.
- Die Zusammenfassungs-Ansicht und der Reiter „Brett/Zusammenfassung“ werden nicht über einen Neustart gemerkt, die App startet immer auf dem Brett.
- Die Einstellung „Threads“ ist ausgegraut: Die eingebaute Lite-Engine nutzt einen Thread.
- **Sprachen:** Deutsch und Englisch (britische Schreibweise). Schon gespeicherte KI-Erklärungen, Zusammenfassungen und Trainingspläne bleiben in der Sprache, in der sie erstellt wurden; neu angeforderte kommen in der eingestellten Sprache. Trainings-Erklärungen werden je Sprache gespeichert. Eröffnungsnamen sind in beiden Sprachen englisch (Lichess-Daten), der App-Name bleibt „Schach-Coach“.
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
- Getestet ist die App unter Linux und Windows; macOS wird gebaut, ist aber ungetestet.
- **Lichess:** Die Partie über Lichess ist mit einem simulierten Server getestet (normaler Verlauf, Zugablehnung, Verbindungsabbruch, Remis, Zeitüberschreitung, Aufgabe, Herausforderungen, Chat) und mit einer echten ungewerteten Partie. Ob der Partiestrom regelmäßig Lebenszeichen schickt, steht nicht in der Lichess-Doku. Bleibt er 20 s still, verbindet die App vorsichtshalber neu (harmlos). Der Lichess-Client stellt Anfragen nacheinander und wartet nach „zu viele Anfragen“ (HTTP 429) eine Minute.
- **Töne:** Wechselt das Audiogerät, während die App läuft (z. B. Bluetooth-Kopfhörer aus und wieder an), bleibt es eventuell still bis zum Neustart der App.

## Lizenz

Schach-Coach steht unter der **GNU General Public License v3.0 oder später** (siehe `LICENSE`), weil die App Stockfish (GPL-3.0) bündelt.

## Lizenzhinweise

- Schriften: IBM Plex (SIL Open Font License), lokal gebündelt über `@fontsource`.
- Figuren: SVG-Satz aus `react-chessboard` (MIT), im Stil der Cburnett-Figuren von Wikimedia Commons.
- Schachlogik: `chess.js` (BSD-2-Clause).
- Figuren und Töne von Lichess (nur eindeutig frei lizenzierte Sätze, z. B. cburnett GPLv2+, SFX AGPLv3+): Liste mit Autor, Lizenz und Quelle in [`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md), Lizenztexte in `assets/licenses/`. Wer die App weitergibt, sollte die Bedingungen dieser Lizenzen (z. B. Quelloffenheit bei GPL/AGPL) selbst prüfen. Die Lichess-Standardtöne sind nicht frei und deshalb nicht enthalten.
- Ton-Set „Einfach (synthetisch)“: von der App selbst berechnet (`src/play/soundSynth.ts`). Abgespielt werden alle Töne in der Desktop-App über `rodio` (MIT/Apache-2.0), dekodiert mit `symphonia` (MPL-2.0).
- **Engine: Stockfish.js 19 (GPL-3.0)**, gebündelt aus dem npm-Paket `stockfish`, und die **native Stockfish 19** (GPL-3.0) aus dem offiziellen Release von github.com/official-stockfish/Stockfish als Sidecar.
- Eröffnungsbuch: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), siehe `data/chess-openings/`. `pnpm build:openings` erzeugt daraus `src/classification/data/openings.json`.
- Test-Fixture `src/test/fixtures/opera-game-evals-d20.json`: echte Stockfish-Bewertungen der Beispielpartie (Tiefe 20, Multi-PV 3), erzeugt mit `GENERATE_EVAL_FIXTURE=1 pnpm vitest run src/test/tools`.
- Beispielpartie `src/test/fixtures/opera-game.pgn`: Morphy – Herzog von Braunschweig & Graf Isouard, Paris 1858 (gemeinfrei).
