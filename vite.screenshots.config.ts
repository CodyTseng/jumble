import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createSharedConfig } from './vite.shared.ts'

export default defineConfig(({ mode, command }) => {
  if (command !== 'serve' || mode !== 'screenshots') {
    throw new Error('Screenshot fixtures are only available through npm run screenshots')
  }
  const shared = createSharedConfig(mode, '/')
  return {
    ...shared,
    resolve: {
      alias: {
        '@/lib/smart-pool': path.resolve(import.meta.dirname, 'src/screenshots/pool.ts'),
        ...shared.resolve?.alias
      }
    },
    server: { host: '0.0.0.0', port: 5180, strictPort: true },
    plugins: [
      react(),
      {
        name: 'jumble-screenshot-entry',
        transformIndexHtml: (html) =>
          html
            .replace('/src/main.tsx', '/src/screenshots/main.ts')
            .replace("img-src 'self' data: blob: http: https:", "img-src 'self' data: blob:")
      }
    ]
  }
})
