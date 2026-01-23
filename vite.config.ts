import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json'
import { normalizeUrl } from './src/lib/url'

const getGitHash = () => {
  try {
    return JSON.stringify(execSync('git rev-parse --short HEAD').toString().trim())
  } catch (error) {
    console.warn('Failed to retrieve commit hash:', error)
    return '"unknown"'
  }
}

const getAppVersion = () => {
  try {
    return JSON.stringify(packageJson.version)
  } catch (error) {
    console.warn('Failed to retrieve app version:', error)
    return '"unknown"'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      'import.meta.env.GIT_COMMIT': getGitHash(),
      'import.meta.env.APP_VERSION': getAppVersion(),
      'import.meta.env.VITE_COMMUNITY_RELAY_SETS': JSON.parse(
        JSON.stringify(env.VITE_COMMUNITY_RELAY_SETS ?? '[]')
      ),
      'import.meta.env.VITE_COMMUNITY_RELAYS': (env.VITE_COMMUNITY_RELAYS ?? '')
        .split(',')
        .map((url) => normalizeUrl(url))
        .filter(Boolean)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,jpg,svg}'],
          globDirectory: 'dist/',
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
  }
})
