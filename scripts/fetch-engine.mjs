// Lädt die native Stockfish-Engine (offizielles Release) und legt sie als Tauri-Sidecar ab.
// Aufruf: pnpm fetch:engine [--target <triple>] [--force]
//
// Ohne --target gilt das System, auf dem gebaut wird. Für den macOS-Universal-Build
// (--target universal-apple-darwin) wird dieselbe Universal-Binary unter allen drei Apple-Namen
// abgelegt, die Tauri erwartet.
//
// Version und Prüfsumme sind fest eingetragen; eine Datei mit abweichender Prüfsumme wird verworfen.
// Die Binary landet unter src-tauri/binaries/stockfish-<target-triple>[.exe] (nicht im Git).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RELEASE = 'sf_19';
// Prüfsummen laut GitHub-Release (Feld „digest“ der Assets)
const LINUX_X64 = {
  file: 'stockfish-linux-x86-64-universal.tar.gz',
  sha256: '9defc0d4e55d49c65a6d042f3e571a39fcea499ade6dbe741b53b8c65e03611f',
};
const LINUX_ARM64 = {
  file: 'stockfish-linux-arm64-universal.tar.gz',
  sha256: 'fe26cfd1d9db4c8af3d21e24d9ff34cacb31c1f940085a7583da11796f2bac01',
};
const WINDOWS_X64 = {
  file: 'stockfish-windows-x86-64-universal.zip',
  sha256: '3c8bf1f9ea66a09350a40df4f632288285ac206d99f33ab5842c408fc30b48a7',
};
/** Eine Binary für Apple Silicon und Intel */
const MACOS = {
  file: 'stockfish-macos-universal.tar.gz',
  sha256: 'a1f0e3bcc5a6927a11fe6fc8e54a779754645f3c2bae2cf13420fd1957adaa77',
};
const APPLE_TRIPLES = ['aarch64-apple-darwin', 'x86_64-apple-darwin', 'universal-apple-darwin'];
const ASSETS = {
  'x86_64-unknown-linux-gnu': LINUX_X64,
  'aarch64-unknown-linux-gnu': LINUX_ARM64,
  'x86_64-pc-windows-msvc': WINDOWS_X64,
  ...Object.fromEntries(APPLE_TRIPLES.map((t) => [t, MACOS])),
};

const targetArg = process.argv.indexOf('--target');
const triple =
  targetArg > 0
    ? process.argv[targetArg + 1]
    : execFileSync('rustc', ['--print', 'host-tuple']).toString().trim();
const asset = ASSETS[triple];
if (!asset) {
  console.error(`Für ${triple} ist noch keine Stockfish-Version eingetragen.`);
  process.exit(1);
}

const binaryName = (t) => `stockfish-${t}${t.includes('windows') ? '.exe' : ''}`;
// Beim macOS-Universal-Build prüft Tauri alle drei Apple-Namen
const names = triple.endsWith('apple-darwin') ? APPLE_TRIPLES : [triple];
const targets = names.map((t) => join('src-tauri', 'binaries', binaryName(t)));
if (targets.every((t) => existsSync(t)) && !process.argv.includes('--force')) {
  console.log(`Schon vorhanden: ${targets.join(', ')} (neu laden mit --force)`);
  process.exit(0);
}

const url = `https://github.com/official-stockfish/Stockfish/releases/download/${RELEASE}/${asset.file}`;
console.log(`Lade ${url} …`);
const response = await fetch(url);
if (!response.ok) {
  console.error(`Download fehlgeschlagen: HTTP ${response.status}`);
  process.exit(1);
}
const data = Buffer.from(await response.arrayBuffer());
const digest = createHash('sha256').update(data).digest('hex');
if (digest !== asset.sha256) {
  console.error(`Prüfsumme stimmt nicht!\n  erwartet: ${asset.sha256}\n  erhalten: ${digest}`);
  process.exit(1);
}
console.log(`Prüfsumme ok (${(data.length / 1e6).toFixed(1)} MB).`);

const work = mkdtempSync(join(tmpdir(), 'schach-coach-stockfish-'));
try {
  const archive = join(work, asset.file);
  writeFileSync(archive, data);
  if (!asset.file.endsWith('.zip')) {
    execFileSync('tar', ['-xzf', archive, '-C', work]);
  } else if (process.platform === 'win32') {
    // PowerShell statt tar: Je nach PATH wäre „tar“ unter Windows das GNU-tar von Git ohne Zip
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        'Expand-Archive -LiteralPath $env:SC_ARCHIVE -DestinationPath $env:SC_WORK',
      ],
      { env: { ...process.env, SC_ARCHIVE: archive, SC_WORK: work } },
    );
  } else {
    execFileSync('unzip', ['-q', archive, '-d', work]);
  }
  // Die eigentliche Programmdatei ist die größte Datei namens stockfish* (ohne Endung .tar.gz)
  const candidates = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) walk(path);
      else if (/^stockfish/.test(name) && !/\.(tar\.gz|zip)$/.test(name))
        candidates.push({ path, size: info.size });
    }
  };
  walk(work);
  const binary = candidates.sort((a, b) => b.size - a.size)[0];
  if (!binary) throw new Error('Keine Stockfish-Binary im Archiv gefunden.');
  mkdirSync(join('src-tauri', 'binaries'), { recursive: true });
  for (const target of targets) {
    copyFileSync(binary.path, target);
    chmodSync(target, 0o755);
    console.log(`Fertig: ${target}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
