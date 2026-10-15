export type Appearance = 'light' | 'dark' | 'auto'
export type ResolvedAppearance = Exclude<Appearance, 'auto'>
type AppearanceController = {
  preference(): Appearance
  resolved(): ResolvedAppearance
  set(value: Appearance): void
  subscribe(listener: () => void): () => void
}
declare global {
  interface Window {
    nappletAppearance?: AppearanceController
  }
}

export const APPEARANCE_KEY = 'napplet.soy.appearance.v1'

// Self-contained: this same function runs before CSS/React in both shells.
// No imports or module-local values may be referenced from inside it.
export function installAppearance(key: string): AppearanceController {
  if (window.nappletAppearance) return window.nappletAppearance
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listeners = new Set<() => void>()
  const valid = (value: unknown): Appearance =>
    value === 'light' || value === 'dark' ? value : 'auto'
  let preference: Appearance = 'auto'
  try {
    preference = valid(localStorage.getItem(key))
  } catch {
    /* Device storage is optional. */
  }
  const resolved = (): ResolvedAppearance =>
    preference === 'auto' ? (media.matches ? 'dark' : 'light') : preference
  const apply = () => {
    const root = document.documentElement
    const mode = resolved()
    root.dataset.theme = mode
    root.dataset.appearance = preference
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    for (const listener of listeners) listener()
  }
  const controller: AppearanceController = {
    preference: () => preference,
    resolved,
    set(value) {
      preference = valid(value)
      try {
        localStorage.setItem(key, preference)
      } catch {
        /* Keep the in-memory selection. */
      }
      apply()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  window.nappletAppearance = controller
  media.addEventListener('change', () => {
    if (preference === 'auto') apply()
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== key && event.key !== null) return
    // Ignore sessionStorage events with the same key.
    try {
      if (event.storageArea && event.storageArea !== localStorage) return
    } catch {
      return
    }
    preference = valid(event.newValue)
    apply()
  })
  apply()
  return controller
}

export const appearanceBootstrap = `(${installAppearance.toString()})(${JSON.stringify(APPEARANCE_KEY)});`
export const appearance = {
  preference: (): Appearance =>
    typeof window === 'undefined' ? 'auto' : installAppearance(APPEARANCE_KEY).preference(),
  set: (value: Appearance) => installAppearance(APPEARANCE_KEY).set(value),
  subscribe: (listener: () => void) => installAppearance(APPEARANCE_KEY).subscribe(listener)
}
export type NappletTheme = {
  title: string
  colors: { background: string; text: string; primary: string }
}
export type ThemeSource = { get(): NappletTheme; subscribe(listener: () => void): () => void }

export const shellTheme: ThemeSource = {
  get() {
    const dark =
      typeof window !== 'undefined' && installAppearance(APPEARANCE_KEY).resolved() === 'dark'
    return {
      title: 'napplet.soy',
      colors: dark
        ? { background: '#171e1a', text: '#f5f1e5', primary: '#9ad4bb' }
        : { background: '#f5f1e4', text: '#1e261c', primary: '#28573d' }
    }
  },
  subscribe(listener) {
    let previous = installAppearance(APPEARANCE_KEY).resolved()
    return appearance.subscribe(() => {
      const next = installAppearance(APPEARANCE_KEY).resolved()
      if (previous === next) return
      previous = next
      listener()
    })
  }
}
