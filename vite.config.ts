import { defineConfig } from 'vitest/config';
import { assetCachePlugin } from './scripts/asset-cache-plugin';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages udostępnia projekt pod /kurwa-moje-pole/, a serwer developerski pod /.
  base: command === 'build' || isPreview ? '/kurwa-moje-pole/' : '/',
  publicDir: 'public',
  plugins: [assetCachePlugin()],
  build: {
    rollupOptions: { input: { main: 'index.html', after: 'after-demo.html', bongo: 'bongo-rush.html' } },
  },
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
}));
