import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect } from 'vitest';

describe('persistent asset worker fallback', () => {
  it.each(['open', 'put', 'none'])('keeps valid assets loadable when storage fails: %s', async (failure) => {
    const listeners = new Map<string, (event: any) => void>();
    const stored = new Map<string, Response>();
    let downloads = 0;
    const cache = {
      match: async (key: string) => stored.get(key)?.clone(),
      put: async (key: string, value: Response) => {
        if (failure === 'put') throw Error('quota');
        stored.set(key, value);
      },
      keys: async () => [],
      delete: async () => true,
    };
    runInNewContext(readFileSync('public/asset-cache-sw.js', 'utf8'), {
      self: {
        location: { href: 'https://festival.test/asset-cache-sw.js', origin: 'https://festival.test' },
        addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener),
      },
      URL,
      Request,
      Response,
      Map,
      Promise,
      caches: {
        open: async () => {
          if (failure === 'open') throw Error('private');
          return cache;
        },
      },
      fetch: async () => {
        downloads++;
        return new Response('valid-model');
      },
    });
    const pending: Promise<unknown>[] = [];
    listeners.get('message')!({
      data: {
        type: 'configure-assets',
        manifest: { schema: 1, assets: { 'game-assets/model.glb': 'hash1' } },
      },
      ports: [],
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    let response!: Promise<Response>;
    const load = async () => {
      listeners.get('fetch')!({
        request: new Request('https://festival.test/game-assets/model.glb'),
        respondWith: (promise: Promise<Response>) => {
          response = promise;
        },
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      });
      return (await response).text();
    };
    expect(await load()).toBe('valid-model');
    expect(await load()).toBe('valid-model');
    await Promise.all(pending);
    expect(downloads).toBe(failure === 'none' ? 1 : 2);
  });
});
