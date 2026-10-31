import { describe, expect, it } from 'vitest'
import { applySkinTone, loadNativeEmojiData, searchNativeEmojis } from './native-emoji-data'

describe('native emoji data', () => {
  it('loads categorized emoji and finds them through the search index', async () => {
    const categories = await loadNativeEmojiData()
    expect(categories.map(({ id }) => id)).toContain('smileys')

    const results = await searchNativeEmojis('grinning', 10)
    expect(results.length).toBeLessThanOrEqual(10)
    expect(results.some(({ char }) => char === '😀')).toBe(true)
    expect(await searchNativeEmojis('   ')).toEqual([])
  })

  it('preserves skin tone selection with the updated emoji dataset', async () => {
    const categories = await loadNativeEmojiData()
    const thumbsUp = categories.flatMap(({ emojis }) => emojis).find(({ char }) => char === '👍')
    expect(thumbsUp).toBeDefined()
    expect(applySkinTone(thumbsUp!, 0)).toBe('👍')
    expect(applySkinTone(thumbsUp!, 3)).toBe('👍🏽')
    expect(applySkinTone(thumbsUp!, 5)).toBe('👍🏿')
  })
})
