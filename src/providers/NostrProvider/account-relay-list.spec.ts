// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { TRelayList } from '@/types'

vi.mock('@/services/client.service', () => ({ default: { setOwnRelayUrls: vi.fn() } }))
import client from '@/services/client.service'
import { useAccountRelayList } from './useAccountRelayList'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('account relay initialization', () => {
  it('registers cached and discovered mailbox URLs synchronously and clears them on account reset', async () => {
    let update!: (list: TRelayList | null) => void
    function Account() {
      const [, setRelayList] = useAccountRelayList()
      update = setRelayList
      return null
    }
    const root = createRoot(document.createElement('div'))
    const list = (url: string): TRelayList => ({
      read: [url],
      write: [url],
      originalRelays: [{ url, scope: 'both' }]
    })
    try {
      await act(async () => root.render(createElement(Account)))
      await act(async () => {
        update(list('wss://cached.local/'))
        expect(client.setOwnRelayUrls).toHaveBeenLastCalledWith(['wss://cached.local/'])
        await Promise.resolve()
        update(list('wss://discovered.local/'))
        // Account queries can start here, before rendering or effects.
        expect(client.setOwnRelayUrls).toHaveBeenLastCalledWith(['wss://discovered.local/'])
        update(null)
        expect(client.setOwnRelayUrls).toHaveBeenLastCalledWith([])
        update({
          read: ['wss://default.local/'],
          write: ['wss://default.local/'],
          originalRelays: []
        })
        expect(client.setOwnRelayUrls).toHaveBeenLastCalledWith([])
      })
    } finally {
      await act(async () => root.unmount())
    }
  })
})
