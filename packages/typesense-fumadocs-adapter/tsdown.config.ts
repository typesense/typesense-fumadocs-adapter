import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./index.ts', './client/index.ts'],
  external: ['typesense', 'fumadocs-core', 'fumadocs-ui', 'react', 'react-dom'],
  dts: true,
  target: 'ES2020',
});
