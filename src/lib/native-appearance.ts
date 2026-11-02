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
