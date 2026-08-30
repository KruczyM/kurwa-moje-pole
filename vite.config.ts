import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({
  publicDir:'public',
  build:{rollupOptions:{input:{main:resolve(__dirname,'index.html'),modelTest:resolve(__dirname,'model-test.html'),animationDiagnostics:resolve(__dirname,'animation-diagnostics.html')}}},
  test:{include:['src/**/*.test.ts']}
});
