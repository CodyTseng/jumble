import { ALLOWED_FILTER_KINDS, ExtendedKind, SUPPORTED_KINDS } from '@/constants'
import { finalizeEvent, generateSecretKey } from 'nostr-tools'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import NipCdCommand from './NipCdCommand'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('./UnknownNote', () => ({
  default: () => createElement('div', null, 'Unknown command event')
}))

const description = 'A <b>plain</b> description.\nSecond line.'
const definition = [
  ['d', 'make'],
  ['command', 'make'],
  ['title', 'Make a reply'],
  ['description', description],
  ['arg', 'topic', 'word', 'required', 'Topic'],
  ['arg', 'format', 'enum', 'optional', 'Output format', 'short', 'long'],
  ['s', 'kind:1'],
  ['s', 'kind:1111'],
  ['s', 'tag:t:notes']
]

function render(tags: string[][]) {
  const event = finalizeEvent(
    { kind: ExtendedKind.NIP_CD_COMMAND, created_at: 1, content: '', tags },
    generateSecretKey()
  )
  return renderToStaticMarkup(createElement(NipCdCommand, { event }))
}

describe('NIP-CD command event card', () => {
  it('renders definitions without subscribing to that kind in feeds', () => {
    expect(SUPPORTED_KINDS).toContain(ExtendedKind.NIP_CD_COMMAND)
    expect(ALLOWED_FILTER_KINDS).not.toContain(ExtendedKind.NIP_CD_COMMAND)
  })

  it('renders trigger, description, ordered arguments, choices and scopes as text', () => {
    const html = render(definition)
    expect(html).toContain('/make')
    expect(html).toContain('Make a reply')
    expect(html).toContain('A &lt;b&gt;plain&lt;/b&gt; description.')
    expect(html).not.toContain('<b>plain</b>')
    expect(html.indexOf('Topic')).toBeLessThan(html.indexOf('Output format'))
    for (const field of [
      'topic: word',
      'format: enum',
      'Required',
      'Optional',
      'short',
      'long',
      'kind:1',
      'kind:1111',
      'tag:t:notes'
    ]) {
      expect(html).toContain(field)
    }
    expect(html).not.toMatch(/<(button|a)\b/)
  })

  it('omits sections when unset and preserves the unknown event fallback for malformed events', () => {
    const minimal = render(definition.slice(0, 4))
    expect(minimal).not.toContain('Arguments')
    expect(minimal).not.toContain('Scopes')
    expect(render(definition.filter(([name]) => name !== 'command'))).toContain(
      'Unknown command event'
    )
  })
})
