import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Reject incomplete LFS checkouts and drift in either the original or approved variant. */
export function verifyBongoSnapshot(root = repository) {
  const source = join(root, 'historical-preview/kurwa-moje-pole');
  const original = JSON.parse(readFileSync(join(root, 'docs/historical-preview/snapshot-manifest.json')));
  const approved = JSON.parse(readFileSync(join(root, 'docs/historical-preview/release-manifest.json')));
  for (const file of original.files) {
    const path = file.path === 'bongo-rush.html' ? 'bongo-original.html' : file.path;
    if (digest(readFileSync(join(source, path))) !== file.sha256)
      throw new Error(`Historical Bongo snapshot mismatch: ${path}`);
  }
  for (const file of approved.files) {
    if (digest(readFileSync(join(source, file.path))) !== file.sha256)
      throw new Error(`Approved Bongo snapshot mismatch: ${file.path}`);
  }
  return { source, approved, original };
}

/** Only relocate the asset base; keep the accepted gameplay and existing render loop intact. */
export function relocateBongoBundle(bundle) {
  const before = 'const $="/kurwa-moje-pole/"';
  if (bundle.split(before).length !== 2) throw new Error('Unexpected Bongo asset-base contract');
  return bundle.replace(before, 'const $=new URL("../",import.meta.url).href');
}

/** Build the current festival first, then install the approved Bongo in its own asset namespace. */
export function packageBongoSnapshot(root = repository, output = join(root, 'dist')) {
  const { source, approved, original } = verifyBongoSnapshot(root);
  if (!readFileSync(join(output, 'index.html')).length) throw new Error('Build the festival before Bongo');
  const target = join(output, 'bongo-v6');
  const bundle = relocateBongoBundle(readFileSync(join(source, approved.bundle), 'utf8'));
  const entryName = `bongo-${digest(bundle).slice(0, 16)}.js`;
  const packaged = [];
  function record(path) {
    const bytes = readFileSync(join(target, path));
    packaged.push({ path, bytes: bytes.length, sha256: digest(bytes) });
  }
  for (const { path } of original.files) {
    if (path === 'bongo-rush.html' || path === 'assets/bongo-B7Wb6hvb.js') continue;
    if (!path.startsWith('game-assets/') && !path.startsWith('assets/'))
      throw new Error(`Unexpected snapshot path: ${path}`);
    mkdirSync(dirname(join(target, path)), { recursive: true });
    copyFileSync(join(source, path), join(target, path));
    record(path);
  }
  writeFileSync(join(target, 'assets', entryName), bundle);
  record(`assets/${entryName}`);
  let html = readFileSync(join(source, approved.entry), 'utf8');
  const assetPrefix = '/kurwa-moje-pole/assets/';
  if (html.split(assetPrefix).length !== 6) throw new Error('Unexpected Bongo HTML assets');
  html = html.replaceAll(assetPrefix, './bongo-v6/assets/');
  if (html.split('bongo-preview-quick-levels.js').length !== 2)
    throw new Error('Unexpected Bongo HTML entry');
  html = html.replace('bongo-preview-quick-levels.js', entryName);
  writeFileSync(join(output, 'bongo-rush.html'), html);
  const manifest = {
    schema: 1,
    sourceCommit: approved.sourceCommit,
    entry: `assets/${entryName}`,
    htmlSha256: digest(html),
    files: packaged,
  };
  writeFileSync(join(target, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = packageBongoSnapshot();
  process.stdout.write(`Approved Bongo v6 packaged: ${result.files.length} files, ${result.entry}\n`);
}
