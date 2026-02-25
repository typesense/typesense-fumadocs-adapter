import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./index.ts', './client/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  external: ['typesense', 'fumadocs-core', 'fumadocs-ui', 'react', 'react-dom'],
  dts: true,
  target: 'ES2020',
});
