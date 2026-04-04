import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    'import.meta.env.GIT_COMMIT': '"test"',
    'import.meta.env.APP_VERSION': '"0.0.0"',
    'import.meta.env.VITE_COMMUNITY_RELAY_SETS': '[]',
    'import.meta.env.VITE_COMMUNITY_RELAYS': '[]'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    include: ['src/**/*.spec.ts']
  }
})
