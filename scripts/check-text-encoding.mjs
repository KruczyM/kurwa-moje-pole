import { readFileSync } from 'node:fs';
import { extname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Sprawdza wszystkie wersjonowane pliki tekstowe: poprawność UTF-8 oraz znaki
 * charakterystyczne dla przypadkowego mojibake.
 */

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const extensionlessTextFiles = new Set(['.gitattributes', '.gitignore']);
const suspiciousCodePoints = new Set([0x00c2, 0x00c3, 0x00c4, 0x00c5, 0x00e2, 0xfffd]);
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const git = spawnSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
if (git.status !== 0) {
  process.stderr.write(git.stderr);
  process.exit(git.status ?? 1);
}

const trackedFiles = git.stdout
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter(
    (file) => textExtensions.has(extname(file).toLowerCase()) || extensionlessTextFiles.has(basename(file)),
  );
const failures = [];

for (const file of trackedFiles) {
  let text;
  try {
    text = utf8Decoder.decode(readFileSync(file));
  } catch {
    failures.push(`${file}: plik nie jest poprawnym UTF-8`);
    continue;
  }

  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const character = [...lines[index]].find((value) => suspiciousCodePoints.has(value.codePointAt(0)));
    if (character) {
      failures.push(
        `${file}:${index + 1}: podejrzany znak U+${character
          .codePointAt(0)
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Wykryto uszkodzone kodowanie lub typowe ślady mojibake:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Kodowanie UTF-8 poprawne: sprawdzono ${trackedFiles.length} plików tekstowych.`);
