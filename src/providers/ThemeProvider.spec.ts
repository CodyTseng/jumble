// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeProvider'

const { updateNativeAppearance } = vi.hoisted(() => ({
  updateNativeAppearance: vi.fn(async () => undefined)
}))
vi.mock('@/lib/native-appearance', () => ({ updateNativeAppearance }))
vi.mock('@/services/local-storage.service', () => ({
  default: { setThemeSetting: vi.fn(), setPrimaryColor: vi.fn() }
}))

let root: Root | undefined
beforeEach(() => {
  localStorage.clear()
  updateNativeAppearance.mockClear()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})
afterEach(async () => {
  if (root) await act(() => root!.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('initial app theme', () => {
  it.each([
    ['light', false, 'light', '#FFFFFF'],
    ['dark', false, 'dark', '#171717'],
    ['pure-black', false, 'pure-black', '#000000'],
    ['system', true, 'dark', '#171717'],
    ['system', false, 'light', '#FFFFFF']
  ] as const)(
    'renders %s with system dark=%s without a light-theme flash',
    async (setting, systemDark, expected, color) => {
      localStorage.setItem('themeSetting', setting)
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
          matches: systemDark,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }))
      )
      const observed: string[] = []
      function Probe() {
        observed.push(useTheme().theme)
        return null
      }
      const container = document.createElement('div')
      document.body.append(container)
      root = createRoot(container)
      await act(() => root!.render(createElement(ThemeProvider, null, createElement(Probe))))
      expect(observed[0]).toBe(expected)
      expect(updateNativeAppearance.mock.calls[0]).toEqual([color, expected !== 'light', setting])
    }
  )
})
