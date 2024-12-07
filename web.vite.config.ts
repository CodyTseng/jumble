import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    outDir: path.resolve(__dirname, 'dist/web'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@renderer': path.resolve('src/renderer/src'),
      '@common': path.resolve('src/common')
    }
  },
  plugins: [react()]
})
