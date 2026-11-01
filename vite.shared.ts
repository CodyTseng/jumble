import { execSync } from 'child_process'
import path from 'path'
import { loadEnv, type UserConfig } from 'vite'
import packageJson from './package.json' with { type: 'json' }
import { normalizeUrl } from './src/lib/url.ts'

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

export const createSharedConfig = (mode: string, base: string): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base,
    build: {
      // Publish mappings alongside bundles so DevTools can resolve source locations.
      sourcemap: true
    },
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
        '@': path.resolve(import.meta.dirname, './src')
      }
    }
  }
}
