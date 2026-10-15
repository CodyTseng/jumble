import { Event } from 'nostr-tools'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PowBadge from '.'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, { minPow }: { minPow: number }) => `difficulty ${minPow}`
  })
}))

function renderBadge(tags: string[][], id = '00000f' + 'f'.repeat(58)) {
  const event: Event = {
    id,
    pubkey: 'a'.repeat(64),
    created_at: 0,
    kind: 1,
    tags,
    content: '',
    sig: 'a'.repeat(128)
  }
  return renderToStaticMarkup(createElement(PowBadge, { event }))
}

describe('PowBadge', () => {
  it.each(['18', '20'])('shows target %s when actual PoW is 20', (target) => {
    const markup = renderBadge([['nonce', '123', target]])
    expect(markup).toContain(`PoW ${target}`)
    expect(markup).toContain(`title="difficulty ${target}"`)
  })

  it('hides the badge when actual PoW is below target', () => {
    expect(renderBadge([['nonce', '123', '21']])).toBe('')
  })

  it.each(['', '0', '-1', '1.5', '20abc', ' 20', '1e1', 'Infinity', '257'])(
    'hides the badge for invalid or zero target %j',
    (target) => {
      expect(renderBadge([['nonce', '123', target]])).toBe('')
    }
  )

  it('hides the badge when the nonce tag or target is missing', () => {
    expect(renderBadge([])).toBe('')
    expect(renderBadge([['nonce', '123']])).toBe('')
  })
})
