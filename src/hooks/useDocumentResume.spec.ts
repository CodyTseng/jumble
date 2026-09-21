import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_RESUME_HIDDEN_MS,
  shouldResumeAfterHiddenDuration
} from './useDocumentResume'

describe('shouldResumeAfterHiddenDuration', () => {
  it('does not resume when there was no hidden timestamp', () => {
    expect(shouldResumeAfterHiddenDuration(null, 1_000_000)).toBe(false)
  })

  it('does not resume for a brief tab switch under the threshold', () => {
    const hiddenAt = 1_000_000
    expect(
      shouldResumeAfterHiddenDuration(hiddenAt, hiddenAt + DOCUMENT_RESUME_HIDDEN_MS - 1)
    ).toBe(false)
  })

  it('resumes after the tab was hidden at least DOCUMENT_RESUME_HIDDEN_MS', () => {
    const hiddenAt = 1_000_000
    expect(
      shouldResumeAfterHiddenDuration(hiddenAt, hiddenAt + DOCUMENT_RESUME_HIDDEN_MS)
    ).toBe(true)
    expect(
      shouldResumeAfterHiddenDuration(hiddenAt, hiddenAt + DOCUMENT_RESUME_HIDDEN_MS + 60_000)
    ).toBe(true)
  })

  it('respects a custom threshold', () => {
    expect(shouldResumeAfterHiddenDuration(100, 250, 100)).toBe(true)
    expect(shouldResumeAfterHiddenDuration(100, 150, 100)).toBe(false)
  })
})
