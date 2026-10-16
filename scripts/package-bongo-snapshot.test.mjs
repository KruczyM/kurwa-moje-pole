import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { packageBongoSnapshot, relocateBongoBundle, verifyBongoSnapshot } from './package-bongo-snapshot.mjs';

test('rejects a missing or repeated asset-base marker', () => {
  assert.throws(() => relocateBongoBundle('other build'), /asset-base/);
  assert.throws(
    () => relocateBongoBundle('const $="/kurwa-moje-pole/";const $="/kurwa-moje-pole/"'),
    /asset-base/,
  );
});

test('packages exactly the accepted Bongo without changing current festival assets', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'bongo-release-'));
  try {
    const root = resolve('.');
    const { source } = verifyBongoSnapshot(root);
    for (const path of [
      'index.html',
      'fighter-demo.html',
      'after-demo.html',
      'assets/current.js',
      'game-assets/2d/bongo-rush/shared.png',
    ]) {
      mkdirSync(join(temporary, path, '..'), { recursive: true });
      writeFileSync(join(temporary, path), path);
    }
    const manifest = packageBongoSnapshot(root, temporary);
    const html = readFileSync(join(temporary, 'bongo-rush.html'), 'utf8');
    assert.match(html, /id="choose-level"/);
    assert.match(html, /href="\.\/"/);
    assert.match(html, /\.\/bongo-v6\/assets\/bongo-[a-f0-9]{16}\.js/);
    assert.doesNotMatch(html, /\/kurwa-moje-pole\/assets\//);
    for (const path of [
      'index.html',
      'fighter-demo.html',
      'after-demo.html',
      'assets/current.js',
      'game-assets/2d/bongo-rush/shared.png',
    ])
      assert.equal(readFileSync(join(temporary, path), 'utf8'), path);
    const published = readFileSync(join(temporary, 'bongo-v6', manifest.entry), 'utf8');
    assert.equal(
      published,
      relocateBongoBundle(readFileSync(join(source, 'assets/bongo-preview-quick-levels.js'), 'utf8')),
    );
    for (const file of manifest.files) {
      const bytes = readFileSync(join(temporary, 'bongo-v6', file.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
      assert.equal(bytes.length, file.bytes);
    }
    const repeated = packageBongoSnapshot(root, temporary);
    assert.deepEqual(repeated, manifest);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
