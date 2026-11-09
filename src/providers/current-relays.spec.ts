// @vitest-environment jsdom
import { act, createElement, useEffect, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/client.service', () => ({ default: { setCurrentRelays: vi.fn() } }))

import client from '@/services/client.service'
import { CurrentRelaysProvider, useCurrentRelays } from './CurrentRelaysProvider'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('explicit relay feed access', () => {
  it('registers access before subscriptions and keeps access until the last feed closes', async () => {
    const url = 'ws://localhost:7447/'
    const subscribe = vi.fn(() => {
      expect(vi.mocked(client.setCurrentRelays).mock.lastCall?.[0]).toEqual([url])
    })
    function Feed() {
      const { addRelayUrls, removeRelayUrls } = useCurrentRelays()
      useLayoutEffect(() => {
        addRelayUrls([url])
        return () => removeRelayUrls([url])
      }, [addRelayUrls, removeRelayUrls])
      useEffect(() => {
        subscribe()
      }, [])
      return null
    }
    const root = createRoot(document.createElement('div'))
    const render = (second: boolean) =>
      createElement(CurrentRelaysProvider, {
        children: [
          createElement(Feed, { key: 'first' }),
          second && createElement(Feed, { key: 'second' })
        ]
      })
    try {
      await act(async () => root.render(render(true)))
      expect(subscribe).toHaveBeenCalledTimes(2)
      await act(async () => root.render(render(false)))
      expect(client.setCurrentRelays).toHaveBeenLastCalledWith([url])
    } finally {
      await act(async () => root.unmount())
    }
    expect(client.setCurrentRelays).toHaveBeenLastCalledWith([])
  })
})
