import './i18n'
import './index.css'
import './polyfill'
import './services/lightning.service'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import blossomCache from './services/blossom-cache.service'
import storage from './services/local-storage.service'
import postDraftService from './services/post-draft.service'

const setVh = () => {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`)
}
window.addEventListener('resize', setVh)
window.addEventListener('orientationchange', setVh)
setVh()

window.addEventListener('beforeunload', (e) => {
  e.preventDefault()
  e.returnValue = ''
})

const root = createRoot(document.getElementById('root')!)

Promise.allSettled([
  storage.hydrate().catch((err) => {
    console.error('[main] storage hydrate failed:', err)
  }),
  postDraftService.init().catch((err) => {
    console.error('[main] post draft init failed:', err)
  })
]).finally(() => {
  // Fire-and-forget: storage is hydrated by now, so re-verify a previously
  // enabled cache server in the background without blocking the first render.
  blossomCache.init().catch((err) => {
    console.error('[main] blossom cache init failed:', err)
  })
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
})
