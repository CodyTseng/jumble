import { findScrollParent, getTextareaLineOffsets } from '@/lib/textarea'
import { RefObject, useEffect, useState } from 'react'

export function interpolateScroll(position: number, points: { source: number; target: number }[]) {
  if (!points.length) return 0
  if (position <= points[0].source) return points[0].target
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1]
    const after = points[i]
    if (position <= after.source) {
      const fraction = (position - before.source) / (after.source - before.source)
      return before.target + fraction * (after.target - before.target)
    }
  }
  return points[points.length - 1].target
}

export default function usePreviewScrollSync(
  textareaRef: RefObject<HTMLTextAreaElement>,
  content: string,
  enabled: boolean
) {
  const [preview, setPreview] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const textarea = textareaRef.current
    if (!enabled || !textarea || !preview) return
    const source = findScrollParent(textarea)
    if (!source) return
    let frame = 0
    let dirty = true
    let points: { source: number; target: number }[] = []

    const measure = () => {
      const sourceMax = source.scrollHeight - source.clientHeight
      const targetMax = preview.scrollHeight - preview.clientHeight
      const sourceTop = source.getBoundingClientRect().top
      const textareaTop = textarea.getBoundingClientRect().top - sourceTop + source.scrollTop
      const previewTop = preview.getBoundingClientRect().top
      const lines = getTextareaLineOffsets(textarea)
      points = [{ source: 0, target: 0 }]
      for (const block of preview.querySelectorAll<HTMLElement>('[data-source-line]')) {
        const line = Number(block.dataset.sourceLine) - 1
        if (lines[line] === undefined) continue
        // Leave space for the editor's sticky header and formatting toolbar.
        const from = textareaTop + lines[line] - 160
        const to = block.getBoundingClientRect().top - previewTop + preview.scrollTop - 24
        const last = points[points.length - 1]
        if (from > last.source && from < sourceMax && to >= last.target && to < targetMax) {
          points.push({ source: from, target: to })
        }
      }
      if (sourceMax > 0) points.push({ source: sourceMax, target: Math.max(0, targetMax) })
      dirty = false
    }

    const sync = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (dirty) measure()
        preview.scrollTop = interpolateScroll(source.scrollTop, points)
      })
    }
    const invalidate = () => {
      dirty = true
      sync()
    }
    const observer = new ResizeObserver(invalidate)
    observer.observe(textarea)
    observer.observe(source)
    observer.observe(preview)
    if (preview.firstElementChild) observer.observe(preview.firstElementChild)
    source.addEventListener('scroll', sync, { passive: true })
    sync()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      source.removeEventListener('scroll', sync)
    }
  }, [textareaRef, content, enabled, preview])
  return setPreview
}
