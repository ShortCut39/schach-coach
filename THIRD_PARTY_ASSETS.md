# Fremde Dateien (Third-party assets)

Schach-Coach liefert einige Figuren- und Ton-Sätze von [Lichess](https://github.com/lichess-org/lila) mit. Sie sind unverändert und liegen in `src/assets/pieces/` und `src/assets/sounds/`. Die Lizenztexte liegen in [`assets/licenses/`](assets/licenses/). Dieselbe Liste zeigt die App unter **Einstellungen → Darstellung → Lizenzen und Quellen**.

Grundlage ist die Datei [`COPYING.md`](https://github.com/lichess-org/lila/blob/master/COPYING.md) von Lichess (geprüft am 11.10.2026, Commit `46d2487`). Mitgeliefert wird nur, was dort eindeutig frei lizenziert ist. Nicht mitgeliefert werden Sätze mit „nicht kommerziell“ (CC BY-NC-SA), „Freeware“ oder ohne Lizenzangabe.

_Schach-Coach bundles a few piece and sound sets from Lichess, unmodified. Only files with a clearly free licence according to Lichess' `COPYING.md` are included; licence texts are in `assets/licenses/`._

## Figuren (pieces)

| Satz     | Autor                       | Lizenz     | Lizenztext                                                                                          | Quelle                                                                                         |
| -------- | --------------------------- | ---------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| cburnett | Colin M.L. Burnett          | GPLv2+     | [GPL-2.0.txt](assets/licenses/GPL-2.0.txt)                                                          | [public/piece/cburnett](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett) |
| Merida   | Armando Hernandez Marroquin | GPLv2+     | [GPL-2.0.txt](assets/licenses/GPL-2.0.txt)                                                          | [public/piece/merida](https://github.com/lichess-org/lila/tree/master/public/piece/merida)     |
| Chessnut | Alexis Luengas              | Apache 2.0 | [Apache-2.0.txt](assets/licenses/Apache-2.0.txt), [Hinweis](assets/licenses/chessnut-COPYRIGHT.txt) | [public/piece/chessnut](https://github.com/lichess-org/lila/tree/master/public/piece/chessnut) |
| RhosGFX  | RhosGFX                     | CC0 1.0    | [CC0-1.0.txt](assets/licenses/CC0-1.0.txt)                                                          | [public/piece/rhosgfx](https://github.com/lichess-org/lila/tree/master/public/piece/rhosgfx)   |
| Fantasy  | Maurizio Monge              | MIT        | [MIT-fantasy.txt](assets/licenses/MIT-fantasy.txt)                                                  | [public/piece/fantasy](https://github.com/lichess-org/lila/tree/master/public/piece/fantasy)   |
| Pixel    | therealqtpi                 | AGPLv3+    | [AGPL-3.0.txt](assets/licenses/AGPL-3.0.txt)                                                        | [public/piece/pixel](https://github.com/lichess-org/lila/tree/master/public/piece/pixel)       |

## Töne (sounds)

Je Satz nur die nötigen OGG-Dateien: `Move`, `Capture`, `Check`, `GenericNotify`, `Victory`, `Defeat`, `Draw`, `LowTime`.

| Satz       | Autor      | Lizenz  | Lizenztext                                   | Quelle                                                                                             |
| ---------- | ---------- | ------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SFX        | Enigmahack | AGPLv3+ | [AGPL-3.0.txt](assets/licenses/AGPL-3.0.txt) | [public/sound/sfx](https://github.com/lichess-org/lila/tree/master/public/sound/sfx)               |
| Piano      | Enigmahack | AGPLv3+ | [AGPL-3.0.txt](assets/licenses/AGPL-3.0.txt) | [public/sound/piano](https://github.com/lichess-org/lila/tree/master/public/sound/piano)           |
| NES        | Enigmahack | AGPLv3+ | [AGPL-3.0.txt](assets/licenses/AGPL-3.0.txt) | [public/sound/nes](https://github.com/lichess-org/lila/tree/master/public/sound/nes)               |
| Futuristic | Enigmahack | AGPLv3+ | [AGPL-3.0.txt](assets/licenses/AGPL-3.0.txt) | [public/sound/futuristic](https://github.com/lichess-org/lila/tree/master/public/sound/futuristic) |

## Nicht mitgeliefert (not included)

- **Lichess-Standardtöne** (`public/sound/standard`, in Lichess `SoundSet.default`): Sie fallen in `COPYING.md` unter die nicht freien Ausnahmen („The other sounds in public/sound“). Wer sie für sich nutzen möchte, kann sie selbst als eigenes Ton-Set hochladen (siehe README); diese Dateien dürfen nicht weitergegeben werden.
- Brettbilder von Lichess: Die App liefert nur Farbpaare im Lichess-Stil (Farben, keine Dateien).
- Selbst erzeugt und ohne fremde Dateien: das Ton-Set „Einfach (synthetisch)“ (`src/play/soundSynth.ts`).

## Hinweis

Die Lizenzen GPL und AGPL verlangen beim Weitergeben unter anderem, dass der Quelltext verfügbar bleibt. Schach-Coach selbst steht unter GPL-3.0-or-later (`LICENSE`). Wer die App verbreitet, sollte die Bedingungen dieser Lizenzen selbst prüfen; diese Liste ist keine Rechtsberatung.
