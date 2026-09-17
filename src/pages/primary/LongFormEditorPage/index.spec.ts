import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LongFormEditorPage from './index'
import useTextareaMention from './useTextareaMention'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { TLongFormDraft } from '@/types/long-form-draft'
import { createLongFormArticleDraftEvent } from '@/lib/draft-event'

const route = vi.hoisted(() => ({ current: 'longFormEditor', display: true, currentIndex: 1 }))
const mocks = vi.hoisted(() => ({
  initialDraft: undefined as TLongFormDraft | undefined,
  publish: vi.fn(),
  navigate: vi.fn(),
  push: vi.fn(),
  pop: vi.fn(),
  publishSettings: vi.fn(() => null),
  singleColumn: false,
  largeScreen: false
}))

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>()
  // Only check render-time activation here; textarea sizing needs a browser.
  return {
    ...react,
    useLayoutEffect: react.useEffect,
    useState: (initial: unknown) => {
      const value = typeof initial === 'function' ? initial() : initial
      return react.useState(
        mocks.initialDraft && value === true
          ? false
          : mocks.initialDraft && value && typeof value === 'object' && 'identifier' in value
            ? mocks.initialDraft
            : value
      )
    }
  }
})
vi.mock('@/PageManager', () => ({
  usePrimaryPage: () => ({ ...route, navigate: mocks.navigate }),
  useSecondaryPage: () => ({ push: mocks.push, pop: mocks.pop, currentIndex: route.currentIndex })
}))
vi.mock('@/providers/NostrProvider', () => ({
  useNostr: () => ({ pubkey: '0'.repeat(64), publish: mocks.publish })
}))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: false, isLargeScreen: mocks.largeScreen })
}))
vi.mock('@/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({ enableSingleColumnLayout: mocks.singleColumn })
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))
vi.mock('@/components/NoteContent/LongFormArticle', () => ({ default: () => null }))
vi.mock('@/components/PostEditor/Uploader', () => ({ default: () => null }))
// The page's own hooks run above PrimaryPageLayout's PageActiveContext.
// Rendering the page without that context reproduces the actual boundary.
vi.mock('@/layouts/PrimaryPageLayout', () => ({ default: vi.fn(() => null) }))
vi.mock('@/layouts/SecondaryPageLayout', () => ({ default: vi.fn(() => null) }))
vi.mock('@/services/local-storage.service', () => ({
  default: { getAddClientTag: () => false, getDefaultMinPow: () => 12 }
}))
vi.mock('@/services/long-form-draft.service', () => ({
  default: { delete: vi.fn(), list: () => [], save: vi.fn() }
}))
vi.mock('@/lib/draft-event', () => ({
  createLongFormArticleDraftEvent: vi.fn(() => ({ content: '', tags: [], kind: 30023 }))
}))
vi.mock('@/lib/event', () => ({ createFakeEvent: (event: object) => event }))
vi.mock('@/lib/mentions', () => ({ extractMentions: async () => ({ pubkeys: [] }) }))
vi.mock('./useTextareaMention', () => ({ default: vi.fn(() => ({ popup: null })) }))
vi.mock('./PublishSettings', () => ({ default: mocks.publishSettings }))
vi.mock('./useArticleMentions', () => ({
  default: () => ({ loading: false, mentions: [], potentialMentions: [], setMentions: vi.fn() })
}))

describe('LongFormEditorPage mention activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.current = 'longFormEditor'
    route.display = true
    route.currentIndex = 1
    mocks.singleColumn = false
    mocks.largeScreen = false
    mocks.initialDraft = undefined
    mocks.publish.mockResolvedValue({ id: 'published' })
  })

  it.each([false, true])(
    'respects the single-column preference on a large screen: %s',
    (singleColumn) => {
      mocks.largeScreen = true
      mocks.singleColumn = singleColumn
      renderToString(createElement(LongFormEditorPage))
      const props = vi.mocked(PrimaryPageLayout).mock.calls[0][0]
      expect((props as { forceScrollArea?: boolean }).forceScrollArea).toBe(!singleColumn)
      const body = props.children as React.ReactNode[]
      const sections = body[0] as React.ReactElement<{ children: React.ReactNode[] }>
      expect(Boolean(sections.props.children[0])).toBe(singleColumn)
    }
  )

  it('enables mentions on the visible editor without an ancestor PageActiveContext', () => {
    renderToString(createElement(LongFormEditorPage))

    expect(useTextareaMention).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
  })

  it('disables mentions when another primary page is active', () => {
    route.current = 'home'
    renderToString(createElement(LongFormEditorPage))

    expect(useTextareaMention).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })

  it('disables mentions when the primary page is hidden', () => {
    route.display = false
    renderToString(createElement(LongFormEditorPage))

    expect(useTextareaMention).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })

  it('enables editing in the secondary stack while keeping the original primary page', () => {
    route.current = 'home'
    route.display = false
    renderToString(createElement(LongFormEditorPage, { index: 1 }))
    expect(useTextareaMention).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
  })

  it('disables mentions when another secondary page covers the editor', () => {
    route.currentIndex = 2
    renderToString(createElement(LongFormEditorPage, { index: 1 }))
    expect(useTextareaMention).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })

  it.each([false, true])(
    'preserves navigation after publishing (secondary editor: %s)',
    async (secondary) => {
      mocks.initialDraft = {
        identifier: 'article',
        title: 'Title',
        content: 'Content',
        summary: '',
        image: '',
        tags: [],
        createdAt: 123,
        updatedAt: 123
      }
      renderToString(createElement(LongFormEditorPage, secondary ? { index: 1 } : {}))
      const layout = secondary ? SecondaryPageLayout : PrimaryPageLayout
      const props = vi.mocked(layout).mock.calls[0][0]
      const controls = props.controls as React.ReactElement<{ children: React.ReactElement[] }>
      const publishButton = controls.props.children.find(
        (child) => child?.props?.onClick && child.props.children === 'Publish'
      )!
      await publishButton.props.onClick()
      expect(mocks.publish).not.toHaveBeenCalled()
      const settings = controls.props.children.find(
        (child) => child?.type === mocks.publishSettings
      )!
      await settings.props.onPublish()

      expect(mocks.publish).toHaveBeenCalledOnce()
      expect(mocks.publish.mock.calls[0][1]).toEqual({
        minPow: 12,
        additionalRelayUrls: [],
        specifiedRelayUrls: undefined
      })
      expect(mocks.pop).toHaveBeenCalledTimes(secondary ? 1 : 0)
      expect(mocks.navigate).not.toHaveBeenCalled()
      expect(mocks.push).not.toHaveBeenCalled()
    }
  )

  it('publishes the selected mentions, flags, PoW and protected relay targets', async () => {
    const relay = 'wss://private.example.com'
    mocks.initialDraft = {
      identifier: 'article',
      title: 'Title',
      content: 'Content',
      summary: '',
      image: '',
      tags: [],
      createdAt: 123,
      updatedAt: 123,
      addClientTag: true,
      isNsfw: true,
      isProtectedEvent: true,
      minPow: 18,
      mentions: [],
      additionalRelayUrls: [relay]
    }
    renderToString(createElement(LongFormEditorPage))
    const controls = vi.mocked(PrimaryPageLayout).mock.calls[0][0].controls as React.ReactElement<{
      children: React.ReactElement[]
    }>
    const button = controls.props.children.find(
      (child) => child?.props?.onClick && child.props.children === 'Publish'
    )!
    await button.props.onClick()
    expect(mocks.publish).not.toHaveBeenCalled()
    const settings = controls.props.children.find((child) => child?.type === mocks.publishSettings)!
    await settings.props.onPublish()
    expect(createLongFormArticleDraftEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mentions: [],
        addClientTag: true,
        isNsfw: true,
        protectedEvent: true
      })
    )
    expect(mocks.publish.mock.calls[0][1]).toEqual({
      minPow: 18,
      additionalRelayUrls: [relay],
      specifiedRelayUrls: [relay]
    })
  })

  it('does not publish a protected article without explicit relays', async () => {
    mocks.initialDraft = {
      identifier: 'article',
      title: 'Title',
      content: 'Content',
      summary: '',
      image: '',
      tags: [],
      createdAt: 123,
      updatedAt: 123,
      isProtectedEvent: true
    }
    renderToString(createElement(LongFormEditorPage))
    const controls = vi.mocked(PrimaryPageLayout).mock.calls[0][0].controls as React.ReactElement<{
      children: React.ReactElement[]
    }>
    const button = controls.props.children.find(
      (child) => child?.props?.onClick && child.props.children === 'Publish'
    )!
    expect(button.props.disabled).toBeFalsy()
    await button.props.onClick()
    const settings = controls.props.children.find((child) => child?.type === mocks.publishSettings)!
    await settings.props.onPublish()
    expect(mocks.publish).not.toHaveBeenCalled()
  })
})
