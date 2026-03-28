import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    // Library build for npm consumers
    return {
      plugins: [react(), dts({ rollupTypes: true, tsconfigPath: './tsconfig.json' })],
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'PandapowerViz',
          formats: ['es', 'cjs'],
          fileName: (format) => `pandapower-viz.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
          },
        },
        outDir: 'dist',
        sourcemap: true,
      },
    };
  }

  if (mode === 'widget') {
    // Widget build for Jupyter (anywidget) — no React, just vis-network + parser
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/widget-entry.ts'),
          formats: ['es'],
          fileName: () => 'widget.js',
        },
        outDir: '../pandapower_viz/_static',
        emptyOutDir: false,
      },
    };
  }

  // Default: standalone app build (for Python server / GitHub Pages)
  return {
    plugins: [react()],
    base: process.env.GITHUB_PAGES ? '/pandapower-viz/' : '/',
    build: {
      outDir: '../pandapower_viz/_static',
      emptyOutDir: true,
    },
  };
});
