# Eröffnungsdaten

Quelle: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (Stand Oktober 2026),
Dateien `a.tsv` bis `e.tsv` unverändert übernommen.

Lizenz laut Quelle: Als Sammlung von Fakten gemeinfrei, zusätzlich unter der
**CC0 Public Domain Dedication** veröffentlicht.

Daraus erzeugt `pnpm build:openings` die Datei `src/classification/data/openings.json`
(Schlüssel = EPD der Stellung, Wert = ECO-Code und Name).
