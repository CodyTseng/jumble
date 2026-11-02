import { App } from '@capacitor/app'
import { isAndroid } from './platform'

/** Native lifecycle signals supplement browser events after Android suspends the WebView. */
export async function initializeNativeLifecycle(): Promise<void> {
  if (!isAndroid()) return
  await App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new Event(isActive ? 'jumble:resume' : 'jumble:pause'))
  })
}
