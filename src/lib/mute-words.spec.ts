import { describe, expect, it } from 'vitest'
import { addLegacyMutedWords, getMutedWordsFromTags, updateMutedWordTag } from './mute-words'

describe('mute word list updates', () => {
  it('reads public and private words case-insensitively', () => {
    expect(
      getMutedWordsFromTags([
        ['word', 'Hello'],
        ['p', 'pubkey'],
        ['word', '世界']
      ])
    ).toEqual(['hello', '世界'])
  })

  it('migrates local words privately even when another client made the word public', () => {
    const privateTags = [
      ['word', 'private'],
      ['p', 'private-user'],
      ['t', 'topic']
    ]
    expect(addLegacyMutedWords(privateTags, [' PUBLIC ', 'Private', 'new', 'NEW', ''])).toEqual([
      ...privateTags,
      ['word', 'public'],
      ['word', 'new']
    ])
  })

  it('updates only the chosen section and preserves other clients’ tags', () => {
    const publicTags = [
      ['p', 'public-user'],
      ['word', 'example', 'extra'],
      ['word', 'other']
    ]
    const privateTags = [
      ['p', 'private-user'],
      ['word', 'EXAMPLE'],
      ['e', 'thread']
    ]
    expect(updateMutedWordTag(publicTags, privateTags, 'Example', 'private', 'remove')).toEqual({
      publicTags: [
        ['p', 'public-user'],
        ['word', 'example', 'extra'],
        ['word', 'other']
      ],
      privateTags: [
        ['p', 'private-user'],
        ['e', 'thread']
      ]
    })
    expect(updateMutedWordTag(publicTags, privateTags, 'example', 'public', 'add')).toEqual({
      publicTags: [
        ['p', 'public-user'],
        ['word', 'example', 'extra'],
        ['word', 'other']
      ],
      privateTags: [
        ['p', 'private-user'],
        ['word', 'EXAMPLE'],
        ['e', 'thread']
      ]
    })
    expect(updateMutedWordTag(publicTags, privateTags, 'new', 'public', 'add')).toEqual({
      publicTags: [...publicTags, ['word', 'new']],
      privateTags
    })
  })
})
