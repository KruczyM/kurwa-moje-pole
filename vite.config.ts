import { defineConfig } from 'vitest/config';
import { assetCachePlugin } from './scripts/asset-cache-plugin';

export default defineConfig(({ command }) => ({
  // GitHub Pages udostępnia projekt pod /kurwa-moje-pole/, a serwer developerski pod /.
  base: command === 'build' ? '/kurwa-moje-pole/' : '/',
  publicDir: 'public',
  plugins: [assetCachePlugin()],
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
}));
