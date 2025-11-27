import guestEngagementService from '@/services/guest-engagement.service'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { useNostr } from '@/providers/NostrProvider'

type TGuestConversionContext = {
  showModal: () => void
  open: boolean
  setOpen: (open: boolean) => void
  isGuest: boolean
}

const GuestConversionContext = createContext<TGuestConversionContext | undefined>(undefined)

export const useGuestConversion = () => {
  const context = useContext(GuestConversionContext)
  if (!context) {
    throw new Error('useGuestConversion must be used within GuestConversionProvider')
  }
  return context
}

export function GuestConversionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { profileEvent } = useNostr()

  // Determine if user is a guest based on whether they have published a profile
  // A guest is someone who hasn't published a profile event (kind 0) to relays
  const isGuest = !profileEvent

  useEffect(() => {
    // Listen for engagement threshold reached
    const unsubscribe = guestEngagementService.subscribe((engagement) => {
      // Only show modal for guest accounts (no published profile) when threshold reached and not dismissed
      if (isGuest && engagement.thresholdReached && !engagement.modalDismissed) {
        setOpen(true)
      }
    })

    return unsubscribe
  }, [isGuest])

  useEffect(() => {
    // Close modal when user is no longer a guest (profile published)
    if (!isGuest) {
      setOpen(false)
    }
  }, [isGuest])

  const showModal = () => {
    setOpen(true)
  }

  return (
    <GuestConversionContext.Provider value={{ showModal, open, setOpen, isGuest }}>
      {children}
    </GuestConversionContext.Provider>
  )
}
