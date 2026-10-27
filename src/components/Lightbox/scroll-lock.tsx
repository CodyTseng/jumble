import { RemoveScrollBar } from 'react-remove-scroll-bar'
import {
  createModule,
  MODULE_NO_SCROLL,
  type ComponentProps,
  type Plugin
} from 'yet-another-react-lightbox'

function ScrollLock({ noScroll: { disabled }, children }: ComponentProps) {
  return (
    <>
      {!disabled && <RemoveScrollBar />}
      {children}
    </>
  )
}

// Share Radix's scrollbar compensation and lock counter. The fixed sidebar
// already uses its --removed-body-scroll-bar-size variable for positioning.
const ScrollLockPlugin: Plugin = ({ replace }) => {
  replace(MODULE_NO_SCROLL, createModule(MODULE_NO_SCROLL, ScrollLock))
}

export default ScrollLockPlugin
