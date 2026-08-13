import { describe, expect, it } from 'vitest'
import { parseYouTubeMessage } from './youtube'

describe('parseYouTubeMessage', () => {
  it('parses messages from the isolated player', () => {
    expect(parseYouTubeMessage('{"event":"onStateChange","info":1,"id":"player"}')).toEqual({
      event: 'onStateChange',
      info: 1,
      id: 'player'
    })
  })

  it.each([null, '', 'not json', '{}', '{"event":1}', { event: 'onReady', id: 1 }])(
    'rejects malformed message %j',
    (message) => {
      expect(parseYouTubeMessage(message)).toBeNull()
    }
  )
})
