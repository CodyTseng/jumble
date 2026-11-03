import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createSharedConfig } from './vite.shared.ts'

export default defineConfig(({ mode }) => ({
  ...createSharedConfig(mode, '/', true),
  build: {
    outDir: 'dist-android',
    sourcemap: true,
    rolldownOptions: {
      input: {
        app: path.resolve(import.meta.dirname, 'index.html'),
        background: path.resolve(import.meta.dirname, 'background/index.html')
      }
    }
  },
  // Native builds bundle assets locally and do not register a PWA service worker.
  plugins: [
    react(),
    {
      name: 'android-viewport',
      transformIndexHtml: (html) => html.replace('viewport-fit=cover', 'viewport-fit=contain')
    }
  ]
}))
