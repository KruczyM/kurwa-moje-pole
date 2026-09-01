import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages udostępnia projekt pod /kurwa-moje-pole/, a serwer developerski pod /.
  base: command === 'build' ? '/kurwa-moje-pole/' : '/',
  publicDir: 'public',
  test: { include: ['src/**/*.test.ts'] },
}));
