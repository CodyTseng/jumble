import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import { createSharedConfig } from './vite.shared.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  ...createSharedConfig(mode, './'),
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rolldownOptions: {
              // Keep native/electron-only deps external; bundle nostr-tools etc.
              external: ['electron', 'ws']
            }
          }
        }
      },
      preload: {
        input: 'electron/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rolldownOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs'
              }
            }
          }
        }
      }
    })
  ]
}))
