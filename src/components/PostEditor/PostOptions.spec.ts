import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PostOptions from './PostOptions'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import storage from '@/services/local-storage.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/ui/slider', () => ({ Slider: vi.fn(() => null) }))
vi.mock('@/components/ui/switch', () => ({ Switch: vi.fn(() => null) }))
vi.mock('@/services/local-storage.service', () => ({
  default: {
    getDefaultMinPow: vi.fn(() => 12),
    setDefaultMinPow: vi.fn(),
    setAddClientTag: vi.fn()
  }
}))

describe('shared post options', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes remembered PoW changes to the shared default and supports forgetting it', () => {
    const setMinPow = vi.fn()
    renderToString(
      createElement(PostOptions, {
        show: true,
        posting: false,
        addClientTag: false,
        setAddClientTag: vi.fn(),
        isNsfw: false,
        setIsNsfw: vi.fn(),
        minPow: 12,
        setMinPow
      })
    )
    vi.mocked(Slider).mock.calls[0][0].onValueChange?.([18])
    expect(setMinPow).toHaveBeenCalledWith(18)
    expect(storage.setDefaultMinPow).toHaveBeenCalledWith(18)
    const remember = vi
      .mocked(Switch)
      .mock.calls.find(([props]) => props.id?.endsWith('-remember-pow'))![0]
    expect(remember.checked).toBe(true)
    remember.onCheckedChange?.(false)
    expect(storage.setDefaultMinPow).toHaveBeenLastCalledWith(null)
  })

  it('only changes the current post when PoW is not remembered', () => {
    vi.mocked(storage.getDefaultMinPow).mockReturnValueOnce(null)
    const setMinPow = vi.fn()
    renderToString(
      createElement(PostOptions, {
        show: true,
        posting: false,
        addClientTag: false,
        setAddClientTag: vi.fn(),
        isNsfw: false,
        setIsNsfw: vi.fn(),
        minPow: 0,
        setMinPow
      })
    )
    vi.mocked(Slider).mock.calls[0][0].onValueChange?.([8])
    expect(setMinPow).toHaveBeenCalledWith(8)
    expect(storage.setDefaultMinPow).not.toHaveBeenCalled()
  })
})
