# Schach-Coach

[Deutsch](README.md) · **English**

A desktop app for analysing your own chess games: Stockfish evaluates every position, the app classifies every move (Brilliant to Blunder), and an LLM behind an OpenAI-compatible endpoint explains the important moves in plain words, in English or German – the good ones too.

> **Status: version 3.** Load games, evaluate them with Stockfish 19 (native as a sidecar, otherwise WASM), classify them and have an AI explain them. There is also a summary with tips, Markdown export, a library, a chat about the position, import from Lichess and Chess.com and a light colour scheme. Plus **patterns across many games** (typical errors, accuracy over time, openings, AI training plan), **training from your own errors** with spaced repetition, and an **English** interface and AI explanations. New: **packages for Windows and macOS** (macOS experimental), built by GitHub Actions.

The app name stays “Schach-Coach” (German for “chess coach”) in both languages.

## Download

Ready-made packages for Linux (AppImage, deb), Windows (installer) and macOS (DMG, experimental) are available under [Releases](https://github.com/ShortCut39/schach-coach/releases). Notes on the first launch on Windows and macOS are in the section [Windows and macOS](#windows-and-macos).

The app starts in German. Switch to English under **Einstellungen → Darstellung & Sprache → Sprache → English**, then click **Speichern**.

## Usage

- **Import:** paste a PGN (checked live below the field), a FEN in the “FEN” tab, or drag a `.pgn` file into the window or pick one. If the text contains several games, a list appears on the right. “You play” decides which side is at the bottom.
- **Analysis:** click a move in the list or use the keyboard: **← / →** one move, **Home / End** start/end, **F** flip the board. Clicking the evaluation graph jumps to that move.
- **Summary:** on the right of the analysis screen, tab “Summary” → “Open summary”. It shows accuracy per phase, move categories, turning points (clickable), the opening, the evaluation graph and the AI's three most important tips. “Export as Markdown” saves everything including the move list and explanations as a `.md` file.
- **Library:** every fully evaluated game ends up here automatically, with explanations, tips and chat. You can search by opening, player or title, filter by “As White”, “As Black” and “Losses”, and sort. “Open” loads the game without recalculating; deleting asks once. If you import the same game again at the same depth, the app reuses the stored evaluations. It only reuses explanations if you picked the same colour again.
- **Patterns across many games:** Library → “Patterns” tab, visible from 3 analysed games.
  - **Typical errors:** each of your errors gets a motif: hung material, missed threat, missed capture, allowed mate, missed mate or other. With frequency and clickable examples that open the game at exactly that move.
  - **Accuracy over time:** a graph across your games, the trend of the last 5 games against the earlier ones, and the phases with accuracy and errors per 10 of your moves.
  - **Openings:** record, accuracy and book length per opening, split by your colour.
  - **Training plan:** from these numbers and concrete examples (in words), the AI writes three recommendations, each with an exercise. The plan is saved.
  - The card in the summary shows the most common pattern.
- **Training from your own errors:** Library → “Training” tab. Every puzzle is the position before one of your errors; your task is to find a better move.
  - **Which errors:** Settings → Training: “Blunders and mistakes”, “Missed chances” and “Inaccuracies” can be switched on or off individually (default: the first two).
  - **Moving:** drag a piece with the mouse, or click a piece and then the target square. As soon as you grab or click one of your pieces, dots show the possible squares (rings where you can capture). Castling: move the king two squares to the side or onto your own rook, by dragging or clicking. Alternatively type the move, in English or German notation (“Nf3”, “Sf3”, “exd5”, “O-O”, “e7e8=Q”). For a promotion the app asks which piece you want.
  - **Checking:** every move that costs at most as much winning chance as an “Excellent” move (2 percentage points) counts as correct. If the move is one of the stored engine moves, the stored analysis is enough; otherwise Stockfish briefly evaluates the position after it (same depth as the analysis, at most 18). The app then shows the opponent's best reply, what would have happened after your game move, and the stored AI explanation if there is one.
  - **AI explanation:** if the AI is set up, it automatically explains after every solved puzzle (also after “Show solution”) why the better move is better than your game move. It only receives data from Stockfish and chess.js: the best move and your game move in words, each with its consequence according to the engine, plus the pieces in danger and the error motif. If you found a different good move, that one is explained too. The explanation of the best move is saved (`trainingExplanations`), so a review does not ask again. Without an AI, the app shows the stored explanation from the analysis if there is one.
  - **Hints:** “Hint” gives a tip about the error motif, “Show piece” highlights the piece of the best move, “Show solution” reveals the move (counts as not solved).
  - **Spaced repetition:** a flashcard system with boxes. Puzzles you solve come back after 1, 3, 7, 14 and 30 days; ones you miss come back immediately and once more in the same session. Solved with “Show piece”, a puzzle stays in its box. A session has at most 12 puzzles: due reviews first, then new ones (the worst errors of the newest games first). The overview shows what is due today.
  - **Practise a pattern:** on the patterns page, “Train this pattern” starts training with puzzles of that motif only.
- **Lichess / Chess.com:** in the import, pick the platform and enter a username → “Load games” fetches the last 20 games (standard chess only, no variants). “You play” is set to your colour automatically. Only the username is sent, to the platform's public API.
- **Chat about the position:** right-hand “Chat” tab. Every question automatically includes the engine data of the position shown (lines and pieces in danger in words, plus the last move). The AI is told to answer only from that.
- **Colour scheme:** Settings → Appearance & language → Dark or Light.
- **Language:** Settings → Appearance & language → Deutsch or English. The language applies to the interface, number and date formats and the AI explanations. Switching also changes the notation (D/T/L/S ↔ Q/R/B/N); afterwards you can still set it separately.
- **Large windows:** the board in analysis and training grows with the window height (about twice as large at 1440p), the columns next to it get wider, and everything is centred. Library, patterns and summary use up to 1800 px of width; the pattern cards then sit three side by side.
- **Pick up where you left off:** the last game is restored on start, with evaluations, explanations, summary and position. Saving is automatic.
- **Keyboard:** in tab bars, ← / → switch tabs. The “Skip to content” link appears at the very top when you press Tab.
- **Engine:** the desktop app runs **native Stockfish 19** as a sidecar; several processes evaluate different positions at the same time. If the binary is missing, the app automatically uses the built-in WASM version. Settings → Engine lets you choose “Native” or “Built-in” and the threads, i.e. how many positions are evaluated at once (Automatic = half the cores, at most 4). The engine starts when the app opens (header: “Stockfish 19 · depth 20” with a green dot). “Analyse” evaluates every position while you can already click through. The engine lines show what was best before the current move; all evaluations are from White's point of view.

## Setting up the AI

1. **Settings → AI connection:** choose a preset (OpenAI, OpenRouter, Ollama, LM Studio or Custom), then enter the base URL, API key and model name. For Ollama and LM Studio leave the key empty.
2. **“Test connection”** sends a tiny request and shows the response time or an understandable error (wrong key, unknown model, not reachable …).
3. **Save.** After every engine analysis, the AI then automatically explains the selected moves (“Explanations for” in the import), in batches of 7 moves.

**The API key** is stored in the system keyring (Linux: Secret Service, e.g. gnome-keyring or KWallet; Windows: Credential Manager; macOS: Keychain), separately for each endpoint (origin). If you change the base URL, a different key or none is used, so a key never goes to another server. It is not in the settings file and is never logged.

**What the LLM receives:** only facts from Stockfish and chess.js: the move, category, FEN before and after, best move, winning chances, main line (at most 6 half-moves), material change and flags (check, mate, capture, sacrifice). The system prompt forbids invented moves, variations and evaluations. Answers are validated with zod and retried once automatically if necessary. If an endpoint rejects `response_format: json_object`, the app asks again without JSON mode.

**“Played well, but not followed up”:** if you play a great or brilliant move and then lose at least 5 percentage points of winning chance in your next two moves, the coach shows a note on the good move.

## How moves are classified

All values are winning chances in percent from the point of view of the side that moves, calculated from the Stockfish evaluation (`src/classification/`). Chess.com does not publish its rules; the rules here are approximations, and all thresholds are in `DEFAULT_CLASSIFICATION`.

| Category                       | Rule                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Book                           | The position after the move is in the Lichess opening book, and the game was in book without interruption until then. Only named book positions count.          |
| Best                           | move played = engine move 1                                                                                                                                     |
| Excellent / Good               | loss ≤ 2 / < 5                                                                                                                                                  |
| Inaccuracy / Mistake / Blunder | loss from 5 / 10 / 20 (changeable in the settings)                                                                                                              |
| Miss                           | The opponent lost ≥ 10 just before, the best move would have won clearly (≥ 80), and you lose ≥ 10.                                                             |
| Great                          | Best/Excellent. The best engine alternative (a different move) is ≥ 10 worse, and the position was not decided (between 10 and 90).                             |
| Brilliant                      | Best/Excellent with a piece sacrifice (material loss ≥ 2 along the main line, not won back immediately). At least 50 afterwards, and not decided before (< 90). |

**Adjustments compared to the original project document** (all with tests):

- **Brilliant with mate:** with the literal rule, 16. Qb8+ would never be brilliant, because White is already winning (mate in 2 = 100). So: if the sacrifice leads to a forced mate while the second-best move does not force mate, the position does not count as “already decided”. This makes 16. Qb8+ brilliant (reference test with real Stockfish data, depth 20).
- **Great:** the move played is compared with the best alternative, not rigidly line 1 with line 2.
- **Sacrifice threshold 2 instead of 3:** lowered on request so that piece-for-pawn sacrifices like Bxh7+ count as well.
- **Sacrifices at the window edge:** the direct reply to an opponent's capture is read even beyond the 8-half-move window. Otherwise a queen trade at the edge would look like a sacrifice.

**Error motifs** (`src/classification/motifs.ts`, in this order):

1. Allowed mate: after the move, the opponent forces mate according to the engine.
2. Missed mate: the best move would have forced mate.
3. Missed threat: a piece that was already in danger gets captured.
4. Hung material: the move puts a piece or pawn in danger, and the best reply captures it.
5. Missed capture: an undefended enemy piece could have been captured.
6. Other.

“In danger” means attacked and undefended, or attacked by a cheaper piece.

**Game phases** (for accuracy per phase, similar to Lichess): endgame from at most 6 pieces excluding pawns and kings, opening up to move 10, middlegame in between.

**Accuracy** per move: `103.1668 · e^(−0.04354 · loss) − 3.1669` (0..100); per player, the average.

## Setup on CachyOS / Arch Linux

System packages for Tauri 2 (list according to the [Tauri docs](https://v2.tauri.app/start/prerequisites/), as of October 2026). On CachyOS, `libappindicator-gtk3` has been replaced by the package `libappindicator`; pacman installs it automatically.

```bash
sudo pacman -Syu
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

Rust via rustup (Arch package, or the official script from rustup.rs):

```bash
sudo pacman -S --needed rustup
rustup default stable
```

Node.js (≥ 22) and pnpm (≥ 10) are needed as well:

```bash
sudo pacman -S --needed nodejs pnpm
```

Install the dependencies:

```bash
pnpm install
```

`pnpm fetch:engine` downloads the native Stockfish engine (official release `sf_19`, 81 MB, SHA-256 checked) into `src-tauri/binaries/`. `pnpm tauri dev` and `pnpm tauri build` call it automatically; if the binary is already there, nothing happens. It is not in Git.

Note: `pnpm-workspace.yaml` deliberately disables the `postinstall` script of the `stockfish` package. It would only create links to the 99 MB full version; the app uses the lite version.

## Running

```bash
pnpm tauri dev      # desktop app with hot reload
pnpm dev            # frontend only, in the browser (http://localhost:1420)
pnpm tauri build    # packages for the current system, see “Linux packages”
```

## Linux packages

```bash
pnpm tauri build
```

The packages are then in `src-tauri/target/release/bundle/`:

- `appimage/Schach-Coach_<version>_amd64.AppImage`: runs directly (`chmod +x`, then execute it).
- `deb/Schach-Coach_<version>_amd64.deb`: for Debian/Ubuntu. On Arch, better use the AppImage or `pnpm tauri dev`.

## Windows and macOS

GitHub Actions builds packages for all three systems (`.github/workflows/build.yml`), because a macOS app can only be built on a Mac, and a Windows installer only sensibly on Windows.

> **macOS is experimental.** The package is built and signed (ad hoc), but has not been tried on a Mac yet. Linux and Windows are tested. If you test it on a Mac, feedback is welcome.

- **Building:** on GitHub, “Actions” tab → “Build” → “Run workflow”. After about 15–25 minutes the packages are at the bottom of the run under “Artifacts”. A Git tag like `v0.1.0` also builds a draft release with all packages.
- **Windows** (`Schach-Coach_<version>_x64-setup.exe`): the installer installs for the current user only and needs no administrator rights. Because the package is not signed, Windows shows “Windows protected your PC” on first launch: click “More info” → “Run anyway”.
- **macOS, experimental** (`Schach-Coach_<version>_universal.dmg`, for Apple Silicon and Intel, macOS 11 or later): drag the app from the DMG into “Applications”. The app is only signed ad hoc (no Apple developer account), so on first launch macOS says that the developer cannot be verified. Then: System Settings → Privacy & Security → “Open Anyway”. On older macOS versions, right-clicking the app → “Open” also works.
- **Engine:** every package contains the official Stockfish 19 binary for its system (`pnpm fetch:engine --target <triple>`, checksums fixed in the script). On macOS it is the universal binary for both processor types.
- **Keyring:** the API key is stored in the Credential Manager on Windows and in the Keychain on macOS, separately per endpoint as on Linux.
- **Data:** settings and library are stored in the system's usual app data folder: `%APPDATA%\de.schachcoach.desktop` on Windows, `~/Library/Application Support/de.schachcoach.desktop` on macOS.

## Checks and tests

```bash
pnpm typecheck      # TypeScript (strict)
pnpm lint           # ESLint
pnpm test           # Vitest
pnpm format         # Prettier
```

## Architecture

The app is a Tauri 2 program: a slim Rust part (`src-tauri/`) opens a window, and the entire interface is React + TypeScript (`src/`).
Domain logic lives in UI-free modules – `chess/` (PGN/FEN, notation), `engine/` (Stockfish as a sidecar or in a web worker), `classification/` (winning chance, move categories, motifs), `llm/` (prompts, client), `online/` (Lichess/Chess.com) and `training/` (puzzles, move checking, spaced repetition) – each tested with Vitest.
State lives in Zustand stores (`store/`, including settings, session and the engine → AI pipeline); components are under `ui/` (`shared/` for building blocks, `screens/` for the four screens, `analyse/`, `import/` and `summary/` for their parts).
All visible texts are in `src/i18n/de.json` and `src/i18n/en.json` and are loaded through i18next. The keys are typed: a wrong key or a missing English text is caught by the type check, and a test also checks that both languages have the same keys and placeholders. The AI texts (prompts and the move descriptions in words from `llm/describe.ts`) exist in both languages as well; the field names of the data stay German so that stored analyses remain valid, and the English prompt explains them. Another language needs a JSON file, an entry in `src/i18n/index.ts` and the AI texts in `src/llm/`.
Colours, radii and fonts are design tokens as CSS variables in `src/styles/tokens.css` and are used as Tailwind classes (`bg-panel`, `text-muted`, `rounded-panel` …).

Design mockups: `docs/mockups/` (local only, not in the repository).

## Known limitations

- **NVIDIA + Wayland:** WebKitGTK otherwise crashes there with “Error 71 (Protocol error)”. On Linux the app therefore sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` on start, unless the variable is already set (`src-tauri/src/main.rs`).
- **TypeScript 6.0 instead of 7:** `typescript-eslint` does not support TypeScript 7 yet. Switching is planned as soon as it does.
- **Content Security Policy:** set strictly in `src-tauri/tauri.conf.json` (own files only, WASM allowed, network only through the Tauri HTTP plugin). Dev mode uses a separate, looser `devCsp` for Vite's hot reload. `style-src` is exempt from Tauri's automatic nonces because React and react-chessboard use inline styles.
- **HTTP permissions:** the app may contact any `https://` address as well as `http://localhost` and `http://127.0.0.1` (`src-tauri/capabilities/default.json`). An LLM server on your home network via `http://192.168…` is therefore not reachable.
- In browser mode (`pnpm dev` without Tauri) there is no keyring: the key only lasts until the page is reloaded. CORS rules may also block requests.
- **Library on disk:** on Linux `~/.local/share/de.schachcoach.desktop/library/` (one metadata and one data file per game; Windows and macOS see above). In browser mode it lives in the browser's `localStorage`.
- **Online import:** Lichess and Chess.com block requests without a suitable user agent. The app sends the user agent of the Tauri HTTP plugin, and both APIs accept it (tested in October 2026). If a platform changes its rules, the app reports “could not be used” or “cannot be reached”.
- **Patterns:** the motifs are simple rule-based approximations. Combinations and positional errors end up under “Other”. For older library entries, the app calculates the statistics once from the stored evaluations the first time the patterns page is opened.
- **Training:** puzzles are created from the stored errors in the library. If a game is deleted, its puzzles disappear. The learning progress is stored in the app settings (`trainingCards`). Move checking compares the stored evaluation before the move with a new, often slightly shallower calculation after it; for moves right at the 2-point limit the verdict can therefore vary. The English screen reader hints of the drag library (dnd-kit) are hidden because react-chessboard does not allow translating them. Instead the app announces moves itself in the selected language, and the input field is the alternative to dragging with the mouse.
- **Chat:** it needs an engine evaluation of the position shown. While the engine is still calculating, sending is disabled.
- **Contrast:** all text colours reach WCAG AA (4.5:1) in both colour schemes. For this, the “faint” token was lightened to `#7f8999` (design: `#6c7686`). The blunder icon (white on `#e0453a`, 4.1:1) and the board coordinates (3.4:1) remain slightly below, both as in the design.
- The summary view and the “Board/Summary” tab are not remembered across restarts; the app always starts on the board.
- The “Threads” setting is greyed out with the built-in engine: the lite engine uses one thread.
- **Languages:** German and English (British spelling). Already stored AI explanations, summaries and training plans stay in the language they were created in; newly requested ones come in the selected language. Training explanations are stored per language. Opening names are English in both languages (Lichess data), and the app name stays “Schach-Coach”.
- Cells in the move list are 32 px high as in the mockup, smaller than the usual 44 px. The keyboard is available as well.
- If a FEN is incomplete, the app fills the trailing fields with defaults: White to move, no castling rights.
- The input on the import screen is kept when switching screens, but not across a restart of the app.
- **Analysis time** (example game, 34 positions, 3 lines, i7-8700):

  | Engine                                    | Depth 16 | Depth 20      |
  | ----------------------------------------- | -------- | ------------- |
  | Native Stockfish 19, 4 parallel processes | 11 s     | 44 s          |
  | WASM Lite, 1 process                      | –        | approx. 3 min |

  The native engine is also much stronger because it uses the big evaluation network. “Depth 20” is therefore not the same for both engines.

- **Why parallel processes instead of many threads:** for fixed-depth searches, extra threads mainly make Stockfish more thorough, but hardly faster (measured: 1 thread 2.4 s, 11 threads 3.8 s for depth 18). Evaluating several positions at the same time is about 3.7 times faster. Each native process needs about 300 MB of memory.
- **Evaluations from different engines are not mixed:** the cache and the library remember which engine calculated. An old lite analysis is recalculated with the native engine.
- **Early stop on mate:** if the best line has a forced mate, the search ends as soon as an iteration of at least depth `max(10, 2 × mate length + 6)` is complete. Calculating further would only refine the side lines and takes over a minute for mate in 1, for example. The depth shown is then the depth actually calculated.
- Evaluations are only cached in memory, not across restarts.
- Opening names come from the Lichess book and are English (e.g. “Philidor Defense”).
- At low depth (e.g. 14), Stockfish evaluates some positions noticeably differently than at depth 20. This also changes the categories.
- The app is tested on Linux and Windows; macOS is built but untested.

## Licence

Schach-Coach is licensed under the **GNU General Public License v3.0 or later** (see `LICENSE`), because the app bundles Stockfish (GPL-3.0).

## Third-party notices

- Fonts: IBM Plex (SIL Open Font License), bundled locally via `@fontsource`.
- Pieces: SVG set from `react-chessboard` (MIT), in the style of the Cburnett pieces from Wikimedia Commons.
- Chess logic: `chess.js` (BSD-2-Clause).
- Sounds while playing: computed by the app itself (`src/play/soundSynth.ts`); no third-party audio files and no Lichess sounds.
- **Engine: Stockfish.js 19 (GPL-3.0)**, bundled from the npm package `stockfish`, and the **native Stockfish 19** (GPL-3.0) from the official release at github.com/official-stockfish/Stockfish as a sidecar.
- Opening book: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), see `data/chess-openings/`. `pnpm build:openings` generates `src/classification/data/openings.json` from it.
- Test fixture `src/test/fixtures/opera-game-evals-d20.json`: real Stockfish evaluations of the example game (depth 20, Multi-PV 3), generated with `GENERATE_EVAL_FIXTURE=1 pnpm vitest run src/test/tools`.
- Example game `src/test/fixtures/opera-game.pgn`: Morphy – Duke of Brunswick & Count Isouard, Paris 1858 (public domain).
