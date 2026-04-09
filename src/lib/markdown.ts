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
