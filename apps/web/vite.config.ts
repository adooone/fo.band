/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Expose Vercel system env (git metadata) to the client alongside VITE_*.
  envPrefix: ['VITE_', 'VERCEL_'],
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
    port: 3300,
    // Dev box reachable over the tailnet by its MagicDNS name.
    allowedHosts: ['deimos', '.ts.net'],
  },
  preview: {
    port: 3300,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    // The dev box has 2 vCPUs and 8 GB shared with the build; one worker is enough.
    maxWorkers: 1,
  },
});
