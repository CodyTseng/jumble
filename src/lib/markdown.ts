/**
 * Detects whether a string contains meaningful Markdown formatting.
 * Strips URLs and nostr: references first to avoid false positives.
 */
export function containsMarkdown(content: string): boolean {
  // Replace URLs and nostr: references with placeholders to avoid false positives
  // while preserving surrounding markdown structure like [text](url)
  const cleaned = content
    .replace(/https?:\/\/[^\s)>\]]+/g, 'URL')
    .replace(/nostr:[a-z0-9]+/g, 'NOSTR')

  // Strong signals — any single one triggers markdown
  const strongPatterns = [
    /```/, // code fence or inline triple backtick
    /\|[\s]*:?-+:?[\s]*\|/, // table separator |---|
    /!\[[^\]]*\]\(/ // image ![alt](
  ]

  for (const pattern of strongPatterns) {
    if (pattern.test(cleaned)) return true
  }

  // Medium signals — need 2+ different types
  const mediumPatterns = [
    /^#{1,6}\s+\S/m, // ATX heading (# text), not #hashtag
    /\*\*[^*\n]+\*\*/, // bold **text**
    /__[^_\n]+__/, // bold __text__
    /\[[^\]]+\]\([^)]+\)/, // link [text](url)
    /^>\s+\S/m, // blockquote > text
    /^\d+\.\s+\S/m, // ordered list 1. item
    /^---$/m, // horizontal rule
    /~~[^~\n]+~~/ // strikethrough ~~text~~
  ]

  let matchCount = 0
  for (const pattern of mediumPatterns) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('m') ? 'gm' : 'g')
    const occurrences = (cleaned.match(globalPattern) || []).length
    matchCount += occurrences
    if (matchCount >= 2) return true
  }

  return false
}

/**
 * Rough reading-time estimate for markdown content.
 * Counts CJK characters (~300/min) and latin word tokens (~220/min) separately
 * so the result holds up for mixed-language articles. Always returns at least 1.
 */
export function estimateReadingMinutes(content: string): number {
  const stripped = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/nostr:[a-z0-9]+/gi, ' ')

  const cjkMatches = stripped.match(/[぀-ヿ㐀-䶿一-鿿가-힯]/g)
  const cjkCount = cjkMatches ? cjkMatches.length : 0

  const latinMatches = stripped
    .replace(/[぀-ヿ㐀-䶿一-鿿가-힯]/g, ' ')
    .match(/[\p{L}\p{N}]+/gu)
  const latinCount = latinMatches ? latinMatches.length : 0

  const minutes = cjkCount / 300 + latinCount / 220
  return Math.max(1, Math.round(minutes))
}
