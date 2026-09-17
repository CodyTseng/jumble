import { autoResizeTextarea, findScrollParent, getTextareaLineOffsets } from '@/lib/textarea'
import { RefObject, useLayoutEffect, useRef } from 'react'

type Tab = 'edit' | 'preview'
type Point = { line: number; top: number }

export function mapPosition(value: number, points: { from: number; to: number }[]) {
  if (!points.length) return 0
  if (value <= points[0].from) return points[0].to
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i]
    if (value <= b.from) return a.to + ((value - a.from) / (b.from - a.from)) * (b.to - a.to)
  }
  return points[points.length - 1].to
}

function getEditorPoints(textarea: HTMLTextAreaElement): Point[] {
  const top = textarea.getBoundingClientRect().top
  return getTextareaLineOffsets(textarea).map((offset, index) => ({
    line: index + 1,
    top: top + offset
  }))
}

function getPreviewPoints(preview: HTMLElement): Point[] {
  const blocks = Array.from(preview.querySelectorAll<HTMLElement>('[data-source-line]'))
  const points = blocks.map((block) => ({
    line: Number(block.dataset.sourceLine),
    top: block.getBoundingClientRect().top
  }))
  const last = blocks.at(-1)
  if (last)
    points.push({
      line: Number(last.dataset.sourceEndLine ?? last.dataset.sourceLine) + 1,
      top: last.getBoundingClientRect().bottom
    })
  return points
}

/** Positions belong to this tab transition only, never to a layout change or draft. */
export default function usePreviewTabPosition(
  textareaRef: RefObject<HTMLTextAreaElement>,
  previewRef: RefObject<HTMLElement>,
  tab: Tab,
  setTab: (tab: Tab) => void,
  enabled: boolean,
  windowScroll = false
) {
  const pending = useRef<{
    line: number
    viewportOffset: number
    atTop: boolean
    next: Tab
    scrollTop: number
  }>()

  const prepareTabChange = (next: Tab) => {
    if (next === tab) return
    const element = tab === 'edit' ? textareaRef.current : previewRef.current
    if (enabled && element) {
      const parent = windowScroll ? null : findScrollParent(element)
      const viewportTop = parent?.getBoundingClientRect().top ?? 0
      const points =
        tab === 'edit' ? getEditorPoints(element as HTMLTextAreaElement) : getPreviewPoints(element)
      const target = viewportTop + 160
      pending.current = {
        next,
        scrollTop: parent?.scrollTop ?? window.scrollY,
        line: mapPosition(
          target,
          points.map(({ line, top }) => ({ from: top, to: line }))
        ),
        viewportOffset: Math.max(160, (points[0]?.top ?? target) - viewportTop),
        atTop: (parent?.scrollTop ?? window.scrollY) <= 1
      }
    }
  }

  const changeTab = (next: Tab) => {
    if (next === tab) return
    if (pending.current?.next !== next) prepareTabChange(next)
    setTab(next)
  }

  useLayoutEffect(() => {
    const position = pending.current
    if (!enabled || !position || position.next !== tab) return
    pending.current = undefined
    const element = tab === 'edit' ? textareaRef.current : previewRef.current
    if (!element) return
    // Both tabs remain mounted. Measure only after the destination is visible.
    if (tab === 'edit') autoResizeTextarea(element as HTMLTextAreaElement)
    const parent = windowScroll ? null : findScrollParent(element)
    const restore = () => {
      if (position.atTop) {
        if (parent) parent.scrollTop = 0
        else window.scrollTo(0, 0)
        return
      }
      const points =
        tab === 'edit' ? getEditorPoints(element as HTMLTextAreaElement) : getPreviewPoints(element)
      if (!points.length || position.line === 0) {
        if (parent) parent.scrollTop = position.scrollTop
        else window.scrollTo(0, position.scrollTop)
        return
      }
      const top = mapPosition(
        position.line,
        points.map(({ line, top }) => ({ from: line, to: top }))
      )
      const delta = top - (parent?.getBoundingClientRect().top ?? 0) - position.viewportOffset
      if (parent) parent.scrollTop += delta
      else window.scrollBy(0, delta)
    }
    restore()
    // Account for browser scroll clamping when hiding the taller tab.
    const frame = requestAnimationFrame(restore)
    const cancel = () => cancelAnimationFrame(frame)
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('pointerdown', cancel)
    return () => {
      cancel()
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('pointerdown', cancel)
    }
  }, [tab, enabled, textareaRef, previewRef, windowScroll])

  return { changeTab, prepareTabChange }
}
