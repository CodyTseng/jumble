export type TTextareaMention = { from: number; to: number; query: string }

export function getTextareaMention(
  value: string,
  selectionStart: number,
  selectionEnd = selectionStart
): TTextareaMention | null {
  if (selectionStart !== selectionEnd) return null
  // Keep email addresses and URLs intact; allow mentions after Markdown
  // punctuation as well as whitespace, including when writing in CJK scripts.
  const match = /(?:^|[\s([{"'*_>“‘，。！？、：；])@([^\s@]*)$/u.exec(
    value.slice(0, selectionStart)
  )
  if (!match) return null
  return {
    from: selectionStart - match[1].length - 1,
    to: selectionStart,
    query: match[1]
  }
}
