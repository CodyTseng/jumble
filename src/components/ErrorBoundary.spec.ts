// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: React.ComponentProps<'button'>) =>
    createElement('button', { onClick }, children)
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function BrokenPreview(): never {
  const error = new TypeError("Cannot read properties of undefined (reading 'find')")
  error.stack = `${error.name}: ${error.message}\n    at x (${window.location.origin}/assets/app.js:1:6)`
  throw error
}

it('displays and copies diagnostic stacks and build information, with a manual-copy fallback', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 3,
        sources: ['../src/lib/event.ts'],
        names: ['getParentETag'],
        mappings: 'KAyCIA'
      })
    })
  )
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', {
    userAgent: navigator.userAgent,
    language: navigator.language,
    onLine: navigator.onLine,
    clipboard: { writeText }
  })
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(createElement(ErrorBoundary, null, createElement(BrokenPreview)))
    })
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    const report = container.querySelector('pre')!.textContent!
    expect(report).toContain('Jumble 0.0.0 (test)')
    expect(report).toContain('Time: ')
    expect(report).toContain('Mode: Web')
    expect(report).toContain(
      'Error stack (source mapped where available):\nTypeError: Cannot read properties'
    )
    expect(report).toContain('../src/lib/event.ts:42:5 [getParentETag]')
    expect(report).toContain(`${window.location.origin}/assets/app.js:1:6`)
    expect(report).toMatch(/Component stack:[\s\S]*BrokenPreview/)
    expect(report).toContain('Browser: ')
    const copy = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Copy Error Details'
    )!
    await act(async () => copy.click())
    expect(writeText).toHaveBeenCalledWith(report)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied')

    writeText.mockRejectedValue(new Error('Clipboard denied'))
    await act(async () => copy.click())
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Please select')
    expect(container.querySelector('pre')?.textContent).toBe(report)
  } finally {
    await act(async () => root.unmount())
  }
})
