import { TSkinTone } from '@/types'
import FlexSearch, { type Index as FlexSearchIndex } from 'flexsearch'

export type TNativeEmoji = {
  hexcode: string
  char: string
  label: string
  tags: string[]
  skins?: string[]
}

export type TNativeEmojiCategoryId =
  | 'smileys'
  | 'people'
  | 'nature'
  | 'food'
  | 'travel'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags'

export type TNativeEmojiCategory = {
  id: TNativeEmojiCategoryId
  labelKey: string
  emojis: TNativeEmoji[]
}

const GROUP_TO_CATEGORY: Record<number, TNativeEmojiCategoryId> = {
  0: 'smileys',
  1: 'people',
  3: 'nature',
  4: 'food',
  5: 'travel',
  6: 'activities',
  7: 'objects',
  8: 'symbols',
  9: 'flags'
}

const CATEGORY_ORDER: TNativeEmojiCategoryId[] = [
  'smileys',
  'people',
  'nature',
  'food',
  'activities',
  'travel',
  'objects',
  'symbols',
  'flags'
]

const CATEGORY_LABELS: Record<TNativeEmojiCategoryId, string> = {
  smileys: 'Smileys & Emotion',
  people: 'People & Body',
  nature: 'Animals & Nature',
  food: 'Food & Drink',
  travel: 'Travel & Places',
  activities: 'Activities',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags'
}

type CompactEmojiRaw = {
  hexcode: string
  unicode: string
  label: string
  tags?: string[]
  group?: number
  order?: number
  skins?: CompactEmojiRaw[]
}

type LoadedData = {
  categories: TNativeEmojiCategory[]
  flat: TNativeEmoji[]
  searchIndex: FlexSearchIndex
}

let loadPromise: Promise<LoadedData> | null = null

async function load(): Promise<LoadedData> {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const raw = (await import('emojibase-data/en/compact.json')).default as CompactEmojiRaw[]

    const buckets: Record<TNativeEmojiCategoryId, TNativeEmoji[]> = {
      smileys: [],
      people: [],
      nature: [],
      food: [],
      travel: [],
      activities: [],
      objects: [],
      symbols: [],
      flags: []
    }
    const flat: TNativeEmoji[] = []

    const sorted = [...raw].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9))

    for (const item of sorted) {
      if (item.group === undefined) continue
      const cat = GROUP_TO_CATEGORY[item.group]
      if (!cat) continue

      const skinChars = item.skins
        ?.slice(0, 5)
        .map((s) => s.unicode)
        .filter((u): u is string => typeof u === 'string')

      const emoji: TNativeEmoji = {
        hexcode: item.hexcode,
        char: item.unicode,
        label: item.label,
        tags: item.tags ?? [],
        skins: skinChars && skinChars.length > 0 ? skinChars : undefined
      }
      buckets[cat].push(emoji)
      flat.push(emoji)
    }

    const categories: TNativeEmojiCategory[] = CATEGORY_ORDER.map((id) => ({
      id,
      labelKey: CATEGORY_LABELS[id],
      emojis: buckets[id]
    })).filter((c) => c.emojis.length > 0)

    const searchIndex = new FlexSearch.Index({ tokenize: 'forward' })
    flat.forEach((e, idx) => {
      searchIndex.add(idx, [e.label, ...e.tags].join(' '))
    })

    return { categories, flat, searchIndex }
  })()
  return loadPromise
}

export async function loadNativeEmojiData(): Promise<TNativeEmojiCategory[]> {
  const { categories } = await load()
  return categories
}

export async function searchNativeEmojis(query: string, limit = 64): Promise<TNativeEmoji[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const { flat, searchIndex } = await load()
  const ids = await searchIndex.searchAsync(trimmed, { limit })
  return ids
    .map((id) => flat[id as number])
    .filter((e): e is TNativeEmoji => Boolean(e))
}

export function applySkinTone(emoji: TNativeEmoji, tone: TSkinTone): string {
  if (tone === 0 || !emoji.skins || emoji.skins.length === 0) return emoji.char
  // emojibase order: light(0), medium-light(1), medium(2), medium-dark(3), dark(4)
  // our scale: 1=light, 2=medium-light, 3=medium, 4=medium-dark, 5=dark — same order
  return emoji.skins[tone - 1] ?? emoji.char
}
