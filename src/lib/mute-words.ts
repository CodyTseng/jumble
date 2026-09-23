export function getMutedWordsFromTags(tags: string[][]): string[] {
  return tags
    .filter(([name, value]) => name === 'word' && value)
    .map(([, value]) => value.toLowerCase())
}

export function addLegacyMutedWords(privateTags: string[][], legacyWords: string[]): string[][] {
  const existing = new Set(getMutedWordsFromTags(privateTags))
  const result = [...privateTags]
  for (const word of legacyWords) {
    const normalized = word.trim().toLowerCase()
    if (!normalized || existing.has(normalized)) continue
    result.push(['word', normalized])
    existing.add(normalized)
  }
  return result
}

export function updateMutedWordTag(
  publicTags: string[][],
  privateTags: string[][],
  word: string,
  visibility: 'public' | 'private',
  action: 'add' | 'remove'
): { publicTags: string[][]; privateTags: string[][] } {
  const normalized = word.trim().toLowerCase()
  const keepOtherTags = (tag: string[]) => tag[0] !== 'word' || tag[1]?.toLowerCase() !== normalized
  const nextPublicTags =
    visibility === 'public' && action === 'remove'
      ? publicTags.filter(keepOtherTags)
      : [...publicTags]
  const nextPrivateTags =
    visibility === 'private' && action === 'remove'
      ? privateTags.filter(keepOtherTags)
      : [...privateTags]
  if (action === 'add' && visibility === 'public' && !publicTags.some((tag) => !keepOtherTags(tag)))
    nextPublicTags.push(['word', normalized])
  if (
    action === 'add' &&
    visibility === 'private' &&
    !privateTags.some((tag) => !keepOtherTags(tag))
  )
    nextPrivateTags.push(['word', normalized])
  return { publicTags: nextPublicTags, privateTags: nextPrivateTags }
}
