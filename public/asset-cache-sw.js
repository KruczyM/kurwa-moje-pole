/* Binary assets only: no HTML, API, multiplayer, credentials or video-range caching. */
const CACHE_NAME = 'festival-assets-v1';
let revisions = new Map();
const CONFIG_KEY = new URL('./__asset_cache_config', self.location.href).href;
let configuration;
function setManifest(manifest) {
  const base = new URL('./', self.location.href);
  revisions = new Map(Object.entries(manifest.assets).map(([path, hash]) =>
    [new URL(path, base).pathname, hash]));
}
function restoreConfiguration() {
  if (!configuration) configuration = caches.open(CACHE_NAME).then(async (cache) => {
    const saved = await cache.match(CONFIG_KEY);
    if (saved && revisions.size === 0) setManifest(await saved.json());
  }).catch(() => undefined);
  return configuration;
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'configure-assets' || event.data.manifest?.schema !== 1) return;
  setManifest(event.data.manifest);
  configuration = Promise.resolve();
  event.ports[0]?.postMessage({ ready: true });
  // Retain unchanged binaries, remove superseded versions only in our own cache.
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.put(CONFIG_KEY, new Response(JSON.stringify(event.data.manifest), { headers: { 'Content-Type': 'application/json' } }));
    for (const key of await cache.keys()) {
      if (key.url === CONFIG_KEY) continue;
      const url = new URL(key.url);
      if (revisions.get(url.pathname) !== url.searchParams.get('__asset_revision')) await cache.delete(key);
    }
  }).catch(() => undefined));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.includes('/game-assets/') || request.headers.has('range')) return;
  event.respondWith((async () => {
    await restoreConfiguration();
    const revision = revisions.get(url.pathname);
    if (!revision) return fetch(request);
    const key = new URL(url.pathname, url.origin);
    key.searchParams.set('__asset_revision', revision);
    let cache;
    try {
      cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(key.href);
      if (hit) return hit;
    } catch { /* Private mode/storage failure: normal loading remains available. */ }
    const response = await fetch(new Request(request, { cache: 'reload' }));
    if (response.ok && response.status !== 206 && cache) await cache.put(key.href, response.clone()).catch(() => undefined);
    return response;
  })());
});
