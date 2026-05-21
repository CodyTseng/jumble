import './i18n'
import './index.css'
import './polyfill'
import './services/lightning.service'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import localBlossomCache from './services/local-blossom-cache.service'
import storage from './services/local-storage.service'

const setVh = () => {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`)
}
window.addEventListener('resize', setVh)
window.addEventListener('orientationchange', setVh)
setVh()

const root = createRoot(document.getElementById('root')!)

Promise.allSettled([
  storage.hydrate().catch((err) => {
    console.error('[main] storage hydrate failed:', err)
  }),
  localBlossomCache.init().catch((err) => {
    console.error('[main] local blossom cache probe failed:', err)
  })
]).finally(() => {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
})
