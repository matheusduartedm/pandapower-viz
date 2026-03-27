import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    // Library build for npm consumers
    return {
      plugins: [react()],
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
        cssFileName: 'style.css',
        outDir: 'dist',
        sourcemap: true,
      },
    };
  }

  // Default: standalone app build (for Python server)
  return {
    plugins: [react()],
    build: {
      outDir: '../pandapower_viz/_static',
      emptyOutDir: true,
    },
  };
});
