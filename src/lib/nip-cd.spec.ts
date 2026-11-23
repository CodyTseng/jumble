import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import { describe, expect, it, vi } from 'vitest'
import {
  COMMAND_DEFINITION_KIND,
  formatNipCdInvocation,
  getNipCdExecutor,
  getNipCdPostKind,
  matchesNipCdScope,
  readNipCdCatalog
} from './nip-cd'
import { normalizeNostrReferences } from './nostr-references'
import { extractMentions } from './mentions'

vi.mock('@/services/client.service', () => ({ default: {} }))
vi.mock('@/services/lightning.service', () => ({ default: {} }))

const bot = generateSecretKey()
const outsider = generateSecretKey()
const executor = getPublicKey(bot)
const sender = getPublicKey(outsider)
const time = 1234
const definition = (scopes: string[], extra: string[][] = [], timestamp = time, key = bot) =>
  finalizeEvent(
    {
      kind: COMMAND_DEFINITION_KIND,
      created_at: timestamp,
      content: '',
      tags: [
        ['d', 'ping'],
        ['command', 'ping'],
        ['title', 'Ping'],
        ['description', 'Pong'],
        ...scopes.map((scope) => ['s', scope]),
        ...extra
      ]
    },
    key
  )
describe('NIP-CD public command definitions', () => {
  it('requires verified executor events and retains the latest coordinate before deciding scope', () => {
    const publicCommand = definition(['kind:1'])
    const newerDmCommand = definition(['kind:14'], [], time + 1)
    const forged = { ...JSON.parse(JSON.stringify(newerDmCommand)), sig: 'a'.repeat(128) }
    expect(
      readNipCdCatalog(
        [publicCommand, forged, definition(['kind:1111'], [], time + 1, outsider)],
        executor,
        time
      )
    ).toMatchObject([{ executor, command: 'ping', scopes: [{ group: 'kind', value: '1' }] }])
    const [dm] = readNipCdCatalog([newerDmCommand, publicCommand], executor, time)
    expect(matchesNipCdScope(dm, { kind: 1 })).toBe(false)
    expect(matchesNipCdScope(dm, { kind: 1111 })).toBe(false)
    const malformed = definition(
      ['kind:1111'],
      [['arg', 'name', 'not-a-type', 'required', 'Name']],
      time + 2
    )
    expect(readNipCdCatalog([publicCommand, malformed], executor, time)).toEqual([])
  })

  it('uses the lower ID at equal timestamps', () => {
    const equal = [definition(['kind:1']), definition(['kind:1111'])]
    const first = [...equal].sort((a, b) => a.id.localeCompare(b.id))[0]
    expect(readNipCdCatalog(equal.reverse(), executor, time)[0].scopes).toEqual([
      { group: 'kind', value: first.tags.find((tag) => tag[0] === 's')![1].slice(5) }
    ])
  })

  it('matches alternatives within a group and requires every distinct group', () => {
    const [command] = readNipCdCatalog(
      [
        definition(
          [
            'kind:1',
            'kind:1111',
            `author:${sender}`,
            'relay:wss://relay.example',
            'tag:t:a',
            'tag:t:b',
            'tag:p'
          ],
          [['arg', 'text', 'text', 'optional', 'Message']]
        )
      ],
      executor,
      time
    )
    expect(command.args).toEqual([
      { name: 'text', label: 'Message', required: false, type: 'text' }
    ])
    const context = {
      kind: 1111 as const,
      author: sender,
      relays: ['wss://relay.example/'],
      tags: [
        ['t', 'b'],
        ['p', executor]
      ]
    }
    expect(matchesNipCdScope(command, context)).toBe(true)
    expect(matchesNipCdScope(command, { ...context, author: executor })).toBe(false)
    expect(matchesNipCdScope(command, { ...context, relays: undefined })).toBe(false)
    expect(matchesNipCdScope(command, { ...context, tags: [['t', 'a']] })).toBe(false)
  })

  it('sets a qualified token at index zero that survives normal mention normalization and extraction', async () => {
    const [command] = readNipCdCatalog([definition(['kind:1'])], executor, time)
    const head = formatNipCdInvocation(command)
    expect(head).toBe(`/ping@nostr:${nip19.npubEncode(executor)}`)
    expect(normalizeNostrReferences(head + ' reply')).toBe(head + ' reply')
    expect(getNipCdExecutor(head + ' reply')).toBe(executor)
    expect(getNipCdExecutor(head.replace('nostr:', ''))).toBe(executor)
    expect(getNipCdExecutor('text ' + head)).toBeUndefined()
    expect(getNipCdExecutor(' ' + head)).toBeUndefined()
    expect(getNipCdExecutor('/ping')).toBeUndefined()
    expect(await extractMentions(head + ' reply')).toMatchObject({ pubkeys: [executor] })
  })

  it('matches the existing outgoing reply kind', () => {
    const note = finalizeEvent({ kind: 1, created_at: time, content: 'hello', tags: [] }, bot)
    const comment = finalizeEvent({ kind: 1111, created_at: time, content: '', tags: [] }, bot)
    expect(getNipCdPostKind(undefined, true)).toBe(1)
    expect(getNipCdPostKind(note, false)).toBe(1)
    expect(getNipCdPostKind(note, true)).toBe(1111)
    expect(getNipCdPostKind(comment, false)).toBe(1111)
    expect(getNipCdPostKind('https://example.com/', false)).toBe(1111)
  })
})
