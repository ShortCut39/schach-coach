// Lädt die native Stockfish-Engine (offizielles Release) und legt sie als Tauri-Sidecar ab.
// Aufruf: pnpm fetch:engine
//
// Version und Prüfsumme sind fest eingetragen; eine Datei mit abweichender Prüfsumme wird verworfen.
// Die Binary landet unter src-tauri/binaries/stockfish-<target-triple> (nicht im Git).
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
const ASSETS = {
  'x86_64-unknown-linux-gnu': {
    file: 'stockfish-linux-x86-64-universal.tar.gz',
    sha256: '9defc0d4e55d49c65a6d042f3e571a39fcea499ade6dbe741b53b8c65e03611f',
  },
};

const triple = execFileSync('rustc', ['--print', 'host-tuple']).toString().trim();
const asset = ASSETS[triple];
if (!asset) {
  console.error(`Für ${triple} ist noch keine Stockfish-Version eingetragen.`);
  process.exit(1);
}

const target = join('src-tauri', 'binaries', `stockfish-${triple}`);
if (existsSync(target) && !process.argv.includes('--force')) {
  console.log(`Schon vorhanden: ${target} (neu laden mit --force)`);
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
  execFileSync('tar', ['-xzf', archive, '-C', work]);
  // Die eigentliche Programmdatei ist die größte Datei namens stockfish* (ohne Endung .tar.gz)
  const candidates = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) walk(path);
      else if (/^stockfish/.test(name) && !name.endsWith('.tar.gz'))
        candidates.push({ path, size: info.size });
    }
  };
  walk(work);
  const binary = candidates.sort((a, b) => b.size - a.size)[0];
  if (!binary) throw new Error('Keine Stockfish-Binary im Archiv gefunden.');
  mkdirSync(join('src-tauri', 'binaries'), { recursive: true });
  copyFileSync(binary.path, target);
  chmodSync(target, 0o755);
  console.log(`Fertig: ${target}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
