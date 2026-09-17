import { describe, expect, it } from 'vitest'
import { getTextareaMention } from './textarea-mention'

describe('getTextareaMention', () => {
  it.each(['@', 'Hello @', 'First line\n@', '> @', '**@', '你好，@'])(
    'opens suggestions at a mention boundary: %s',
    (value) => {
      expect(getTextareaMention(value, value.length)).toEqual({
        from: value.length - 1,
        to: value.length,
        query: ''
      })
    }
  )

  it.each(['alice', '张三', 'علي', 'alice.example'])('supports query %s', (query) => {
    const value = `Hello @${query}`
    expect(getTextareaMention(value, value.length)).toEqual({
      from: 6,
      to: value.length,
      query
    })
  })

  it('limits the replacement range to the mention before the caret', () => {
    expect(getTextareaMention('Hello @alice, welcome!', 12)).toEqual({
      from: 6,
      to: 12,
      query: 'alice'
    })
  })

  it.each([
    'alice@example.com',
    'https://example.com/@alice',
    '@@alice',
    '@alice hello',
    '@alice\n'
  ])('does not open suggestions for %s', (value) => {
    expect(getTextareaMention(value, value.length)).toBeNull()
  })

  it('does not replace selected text', () => {
    expect(getTextareaMention('@alice', 1, 6)).toBeNull()
  })

  it('finds the current mention when there is more than one', () => {
    expect(getTextareaMention('@alice and @bob', 15)).toEqual({
      from: 11,
      to: 15,
      query: 'bob'
    })
  })
})
