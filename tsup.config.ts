import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['next'],
  },
  {
    entry: {
      'next/index': 'src/next/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    external: ['next', 'next/server'],
  },
]);
