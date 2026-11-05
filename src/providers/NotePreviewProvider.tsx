import { createContext, useContext } from 'react'

const NotePreviewContext = createContext(false)

export const useNotePreview = () => useContext(NotePreviewContext)

/** Compact, read-only note content without autoplay or interaction-result queries. */
export function NotePreviewProvider({ children }: { children: React.ReactNode }) {
  return <NotePreviewContext.Provider value>{children}</NotePreviewContext.Provider>
}
