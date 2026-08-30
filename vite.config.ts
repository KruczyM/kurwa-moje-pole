import {defineConfig} from 'vitest/config';
export default defineConfig({
  publicDir:'public',
  test:{include:['src/**/*.test.ts']}
});
