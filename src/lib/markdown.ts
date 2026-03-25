/**
 * Detects whether a string contains meaningful Markdown formatting.
 * Strips URLs and nostr: references first to avoid false positives.
 */
export function containsMarkdown(content: string): boolean {
  // Remove URLs and nostr: references to avoid false positives
  const cleaned = content
    .replace(/https?:\/\/[^\s)>\]]+/g, '')
    .replace(/nostr:[a-z0-9]+/g, '')

  // Strong signals — any single one triggers markdown
  const strongPatterns = [
    /^```/m, // code fence
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
    /^[-*]\s+\S/m, // unordered list - item or * item
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
