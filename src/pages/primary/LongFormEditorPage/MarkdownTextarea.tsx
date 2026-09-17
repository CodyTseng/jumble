import { Textarea } from '@/components/ui/textarea'
import { autoResizeTextarea, scrollTextareaCaretIntoView } from '@/lib/textarea'
import {
  ComponentPropsWithoutRef,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef
} from 'react'

/** Own sizing and caret following together, once per content update before paint. */
const MarkdownTextarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<typeof Textarea>>(
  ({ value, onCompositionStart, onCompositionEnd, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const composing = useRef(false)
    const previousValue = useRef(value)
    useImperativeHandle(ref, () => textareaRef.current!, [])

    const followCaret = () => {
      const textarea = textareaRef.current
      if (
        !textarea ||
        composing.current ||
        document.activeElement !== textarea ||
        textarea.selectionStart !== textarea.selectionEnd
      )
        return
      scrollTextareaCaretIntoView(textarea)
    }

    useLayoutEffect(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      autoResizeTextarea(textarea)
      if (previousValue.current !== value) followCaret()
      previousValue.current = value
    }, [value])

    useLayoutEffect(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      let width = textarea.clientWidth
      const observer = new ResizeObserver(() => {
        if (textarea.clientWidth === width) return
        width = textarea.clientWidth
        autoResizeTextarea(textarea)
      })
      observer.observe(textarea)
      return () => observer.disconnect()
    }, [])

    return (
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onCompositionStart={(event) => {
          composing.current = true
          onCompositionStart?.(event)
        }}
        onCompositionEnd={(event) => {
          composing.current = false
          onCompositionEnd?.(event)
          autoResizeTextarea(event.currentTarget)
          followCaret()
        }}
      />
    )
  }
)
MarkdownTextarea.displayName = 'MarkdownTextarea'
export default MarkdownTextarea
