import App from './App'
import { isAndroid } from './lib/platform'
import { ErrorBoundary } from './components/ErrorBoundary'
import { i18nReady } from './i18n'
import { startNativeLocalStorageBackup } from './lib/native-local-storage'
import blossomCache from './services/blossom-cache.service'
import storage from './services/local-storage.service'
import postDraftService from './services/post-draft.service'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function runAfterFirstPaint(task: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(task, { timeout: 2000 })
      } else {
        globalThis.setTimeout(task, 0)
      }
    })
  })
}

export async function startApplication() {
  await Promise.all([
    i18nReady,
    storage.hydrate().catch((error) => {
      if (isAndroid()) throw error
      console.error('[main] storage hydrate failed:', error)
    })
  ])

  startNativeLocalStorageBackup()

  const root = createRoot(document.getElementById('root')!)
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )

  // These tasks are useful but do not affect the first interactive frame.
  runAfterFirstPaint(() => {
    void postDraftService.init().catch((error) => {
      console.error('[main] post draft init failed:', error)
    })
    void blossomCache.init().catch((error) => {
      console.error('[main] blossom cache init failed:', error)
    })
  })
}
