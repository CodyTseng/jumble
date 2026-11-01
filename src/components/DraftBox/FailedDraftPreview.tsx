import { Component, ReactNode } from 'react'
import { Event, validateEvent } from 'nostr-tools'
import Note from '../Note'

// A broken outbox preview must not take away the user's retry/delete controls.
class PreviewBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default function FailedDraftPreview({ event }: { event: Event }) {
  const fallback = (
    <div dir="auto" className="break-words whitespace-pre-wrap">
      {typeof event?.content === 'string' ? event.content : ''}
    </div>
  )

  if (!validateEvent(event)) return fallback

  return (
    <PreviewBoundary key={event?.id} fallback={fallback}>
      <Note event={event} showFull hideHeader />
    </PreviewBoundary>
  )
}
