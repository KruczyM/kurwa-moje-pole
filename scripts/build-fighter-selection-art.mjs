// Deterministic web delivery derivatives; originals remain untouched in art/.
// Requires ImageMagick 7 on PATH. Run from the repository root.
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ids = [
  'amper',
  'korba',
  'klatwa',
  'chlebak',
  'kobra',
  'zawor',
  'szerszen',
  'dziaslo',
  'hemoroid',
  'jeczmien',
  'ambona',
  'antena',
  'gruczol',
  'krwiak',
  'pien',
  'pierscien',
];
const source = 'art/fighter/stance-anchors-v1';
const output = 'public/game-assets/2d/fighter/selection-v1';
for (const id of ids) {
  const input = `${source}/${id === 'amper' ? 'amper-approved' : id}.png`;
  if (!existsSync(input)) throw new Error(`Missing stance anchor: ${input}`);
}
mkdirSync(output, { recursive: true });
for (const id of ids) {
  const input = `${source}/${id === 'amper' ? 'amper-approved' : id}.png`;
  execFileSync('magick', [
    input,
    '-resize',
    '384x576',
    '-strip',
    '-quality',
    '82',
    `${output}/${id}-full.webp`,
  ]);
  // Top square: face and raised guard, never the feet or empty lower backdrop.
  execFileSync('magick', [
    input,
    '-gravity',
    'north',
    '-crop',
    '100%x62%+0+0',
    '+repage',
    '-resize',
    '192x192^',
    '-gravity',
    'center',
    '-extent',
    '192x192',
    '-strip',
    '-quality',
    '82',
    `${output}/${id}-thumb.webp`,
  ]);
}
console.log(`Prepared ${ids.length} full previews and ${ids.length} thumbnails.`);
