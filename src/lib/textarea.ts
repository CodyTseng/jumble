const MIRROR_PROPS = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'direction'
] as const

// Measure the caret's position inside a textarea by mirroring its
// content and styles into a hidden div and locating a marker span.
export function getTextareaCaretRect(
  textarea: HTMLTextAreaElement,
  position = textarea.selectionEnd
) {
  const computed = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  mirror.style.position = 'absolute'
  mirror.style.top = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.dir = textarea.dir
  for (const prop of MIRROR_PROPS) {
    mirror.style[prop] = computed[prop]
  }
  mirror.textContent = textarea.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const top = marker.offsetTop
  const left = marker.offsetLeft
  const height = marker.getBoundingClientRect().height
  document.body.removeChild(mirror)
  const rect = textarea.getBoundingClientRect()
  return new DOMRect(
    rect.left + left - textarea.scrollLeft,
    rect.top + top - textarea.scrollTop,
    0,
    // The marker's top already includes the line's leading. Using the full
    // line-height here would push popups below the actual caret bottom.
    height
  )
}

export function findScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const overflowY = getComputedStyle(parent).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return parent
    parent = parent.parentElement
  }
  return null
}

/** Measure source lines with the textarea's actual font, width and soft wrapping. */
export function getTextareaLineOffsets(textarea: HTMLTextAreaElement): number[] {
  const computed = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  for (const prop of MIRROR_PROPS) mirror.style[prop] = computed[prop]
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '-9999px',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    pointerEvents: 'none'
  })
  mirror.dir = textarea.dir
  const lines = textarea.value.split('\n').map((line) => {
    const span = document.createElement('span')
    span.textContent = line || '\u200b'
    mirror.append(span, '\n')
    return span
  })
  document.body.append(mirror)
  const top = mirror.getBoundingClientRect().top
  const offsets = lines.map((line) => line.getClientRects()[0].top - top)
  mirror.remove()
  return offsets
}

/**
 * Resize an auto-growing textarea to fit its content without the page jumping.
 * Measure off-screen so the live editor never collapses and causes the browser
 * to clamp its parent's scroll position or scroll the caret inside the textarea.
 */
export function autoResizeTextarea(textarea: HTMLTextAreaElement) {
  const computed = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  for (const prop of MIRROR_PROPS) mirror.style[prop] = computed[prop]
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '-9999px',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    pointerEvents: 'none'
  })
  mirror.dir = textarea.dir
  // Keep the final empty line measurable after Enter.
  mirror.textContent = `${textarea.value}\u200b`
  document.body.append(mirror)
  const padding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom)
  const border = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth)
  const height = mirror.scrollHeight + (computed.boxSizing === 'border-box' ? border : -padding)
  mirror.remove()
  textarea.style.overflowAnchor = 'none'
  const nextHeight = `${height}px`
  if (textarea.style.height !== nextHeight) textarea.style.height = nextHeight
  textarea.scrollTop = 0
}

/**
 * Reveal the caret only when it leaves the visible area. Do not recenter a
 * visible caret on every keystroke or fight the browser's native caret reveal.
 */
export function scrollTextareaCaretIntoView(
  textarea: HTMLTextAreaElement,
  {
    topMargin = 160,
    bottomMargin = 32
  }: {
    topMargin?: number
    bottomMargin?: number
  } = {}
) {
  const caret = getTextareaCaretRect(textarea)

  const container = findScrollParent(textarea)
  const viewportTop = window.visualViewport?.offsetTop ?? 0
  const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight)
  const containerRect = container?.getBoundingClientRect()
  const topLimit = (containerRect?.top ?? viewportTop) + topMargin
  const bottomLimit =
    Math.min(containerRect?.bottom ?? viewportBottom, viewportBottom) - bottomMargin

  const delta = getCaretScrollDelta(caret.top, caret.bottom, topLimit, bottomLimit)
  if (Math.abs(delta) < 1) return

  if (container) {
    container.scrollTop += delta
  } else {
    window.scrollBy(0, delta)
  }
}

export function getCaretScrollDelta(
  caretTop: number,
  caretBottom: number,
  top: number,
  bottom: number
) {
  if (bottom <= top) return 0
  if (caretBottom > bottom) return caretBottom - bottom
  return caretTop < top ? caretTop - top : 0
}
