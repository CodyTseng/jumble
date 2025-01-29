export function getCaretPosition(element: HTMLTextAreaElement) {
  return {
    caretStartIndex: element.selectionStart || 0,
    caretEndIndex: element.selectionEnd || 0
  }
}

export function getCurrentWord(element: HTMLTextAreaElement) {
  const text = element.value
  const { caretStartIndex } = getCaretPosition(element)

  // Find the start position of the word
  let start = caretStartIndex
  while (start > 0 && text[start - 1].match(/\S/)) {
    start--
  }

  // Find the end position of the word
  let end = caretStartIndex
  while (end < text.length && text[end].match(/\S/)) {
    end++
  }

  const w = text.substring(start, end)

  return w
}

export function replaceWord(element: HTMLTextAreaElement, value: string) {
  const text = element.value
  const caretPos = element.selectionStart

  // Find the word that needs to be replaced
  const wordRegex = /[\w@#]+/g
  let match
  let startIndex
  let endIndex

  while ((match = wordRegex.exec(text)) !== null) {
    startIndex = match.index
    endIndex = startIndex + match[0].length

    if (caretPos >= startIndex && caretPos <= endIndex) {
      break
    }
  }

  // Replace the word with a new word using document.execCommand
  if (startIndex !== undefined && endIndex !== undefined) {
    // Preserve the current selection range
    const selectionStart = element.selectionStart
    const selectionEnd = element.selectionEnd

    // Modify the selected range to encompass the word to be replaced
    element.setSelectionRange(startIndex, endIndex)

    // REMINDER: Fastest way to include CMD + Z compatibility
    // Execute the command to replace the selected text with the new word
    document.execCommand('insertText', false, value)

    // Restore the original selection range
    element.setSelectionRange(
      selectionStart - (endIndex - startIndex) + value.length,
      selectionEnd - (endIndex - startIndex) + value.length
    )
  }
}
