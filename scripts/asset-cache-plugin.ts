import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import type { Plugin } from 'vite';

/** Hash public runtime assets only; videos/range requests remain streamed. */
export function assetCachePlugin(): Plugin {
  let root = '';
  const hashes = new Map<string, { stamp: string; hash: string }>();
  async function manifest() {
    const assets: Record<string, string> = {};
    async function walk(directory: string) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = resolve(directory, entry.name);
        if (entry.isDirectory()) await walk(file);
        else if (/\.(glb|gltf|bin|png|jpe?g|webp|ktx2|mp3|ogg|wav|mid)$/i.test(entry.name)) {
          const info = await stat(file);
          const stamp = `${info.size}:${info.mtimeMs}`;
          let cached = hashes.get(file);
          if (cached?.stamp !== stamp) {
            const hash = createHash('sha256');
            for await (const chunk of createReadStream(file)) hash.update(chunk);
            cached = { stamp, hash: hash.digest('hex') };
            hashes.set(file, cached);
          }
          assets[relative(root, file).replaceAll('\\', '/')] = cached.hash;
        }
      }
    }
    await walk(resolve(root, 'game-assets'));
    return JSON.stringify({ schema: 1, assets });
  }
  return {
    name: 'festival-persistent-assets',
    configResolved(config) {
      root = resolve(config.root, 'public');
    },
    configureServer(server) {
      server.middlewares.use('/asset-cache-manifest.json', (_req, res, next) => {
        void manifest()
          .then((body) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(body);
          })
          .catch(next);
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'asset-cache-manifest.json', source: await manifest() });
    },
  };
}
