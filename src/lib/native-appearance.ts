import type { TThemeSetting } from '@/types'
import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './platform'

interface NativeAppearancePlugin {
  setTheme(options: {
    backgroundColor: string
    dark: boolean
    themeSetting: TThemeSetting
  }): Promise<void>
  ready(): Promise<void>
  getKeyboardVisibility(): Promise<{ visible: boolean }>
  addListener(
    event: 'keyboardVisibilityChanged',
    listener: (state: { visible: boolean }) => void
  ): Promise<import('@capacitor/core').PluginListenerHandle>
}

const NativeAppearance = registerPlugin<NativeAppearancePlugin>('JumbleAppearance')

/** Keep the native inset areas and system icons aligned with the resolved app theme. */
export async function updateNativeAppearance(
  backgroundColor: string,
  dark: boolean,
  themeSetting: TThemeSetting
): Promise<void> {
  if (!isAndroid()) return
  await NativeAppearance.setTheme({ backgroundColor, dark, themeSetting })
  await finishNativeStartup()
}

let startupReady: Promise<void> | undefined

/** Release the native launch screen only after the themed React surface can paint. */
export async function finishNativeStartup(): Promise<void> {
  if (!isAndroid()) return
  startupReady ??= new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }).then(() => NativeAppearance.ready())
  await startupReady
}

/** Observe the OS keyboard, including a keyboard already open when the bar mounts. */
export function observeNativeKeyboard(onChange: (visible: boolean) => void): () => void {
  if (!isAndroid()) return () => {}
  let disposed = false
  let revision = 0
  let listener: import('@capacitor/core').PluginListenerHandle | undefined
  void NativeAppearance.addListener('keyboardVisibilityChanged', ({ visible }) => {
    revision++
    if (!disposed) onChange(visible)
  })
    .then(async (handle) => {
      if (disposed) {
        await handle.remove()
        return
      }
      listener = handle
      const snapshot = revision
      const { visible } = await NativeAppearance.getKeyboardVisibility()
      if (!disposed && revision === snapshot) onChange(visible)
    })
    .catch((error) => console.error('[native] keyboard observation failed:', error))
  return () => {
    disposed = true
    void listener?.remove()
  }
}
