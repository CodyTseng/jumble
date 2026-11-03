import './index.css'
import './polyfill'

import { finishNativeStartup } from './lib/native-appearance'
import { initializeNativeLifecycle } from './lib/native-lifecycle'
import { isAndroid, isElectron } from './lib/platform'
import { restoreNativeLocalStorage } from './lib/native-local-storage'

const setVh = () => {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`)
}
window.addEventListener('resize', setVh)
window.addEventListener('orientationchange', setVh)
setVh()

const bootstrap = async () => {
  // Electron without an OS keychain encrypts its stores with a password-derived
  // key; gate the boot behind the unlock screen first. Returns true when a
  // post-unlock reload is pending, in which case booting stops here.
  if (isElectron()) {
    // The unlock UI imports i18n. Load it only on desktop so mobile language
    // detection cannot run before native preferences have been restored.
    const { ensureElectronStorageUnlocked } = await import('./lib/electron-unlock')
    if (await ensureElectronStorageUnlocked()) return
  }

  // Native apps restore their encrypted snapshot before modules that read
  // localStorage are evaluated. Web mode returns immediately.
  await restoreNativeLocalStorage()
  await initializeNativeLifecycle()

  // Defer application modules until the native shell has restored its durable
  // snapshot, including preferences used by language detection.
  const { startApplication } = await import('./app-bootstrap')
  await startApplication()
}

bootstrap().catch((error) => {
  console.error('[main] failed to bootstrap application:', error)
  if (isAndroid()) {
    // Fail closed rather than opening an empty session and overwriting encrypted data.
    const root = document.getElementById('root')!
    const message = document.createElement('p')
    message.textContent =
      'Unable to start Jumble. Restart Jumble to try again. Your saved data has not been reset.'
    const retry = document.createElement('button')
    retry.textContent = 'Retry'
    retry.onclick = () => window.location.reload()
    root.replaceChildren(message, retry)
    void finishNativeStartup().catch(console.error)
  }
})
