import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json'
import { createSharedConfig } from './vite.shared'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  ...createSharedConfig(mode, '/'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg}'],
        globDirectory: 'dist/',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Jumble',
        short_name: 'Jumble',
        icons: [
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-monochrome.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'monochrome'
          }
        ],
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        description: packageJson.description
      }
    })
  ]
}))
