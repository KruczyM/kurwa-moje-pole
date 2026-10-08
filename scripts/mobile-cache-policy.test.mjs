import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('mobile world uses HTTP cache without a CacheStorage response clone', () => {
  const listeners = new Map();
  runInNewContext(readFileSync(new URL('../public/asset-cache-sw.js', import.meta.url), 'utf8'), {
    URL,
    self: {
      location: { href: 'https://festival.test/asset-cache-sw.js', origin: 'https://festival.test' },
      addEventListener: (name, callback) => listeners.set(name, callback),
    },
  });
  let intercepted = false;
  listeners.get('fetch')({
    request: { url: 'https://festival.test/game-assets/world/festival/authored-festival-mobile.glb' },
    respondWith: () => {
      intercepted = true;
    },
  });
  assert.equal(intercepted, false);
});
