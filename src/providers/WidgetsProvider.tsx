import { StorageKey } from '@/constants'
import localStorageService from '@/services/local-storage.service'
import { TrendingUp, Bitcoin, Pin, MessageSquare, Compass, Sparkles } from 'lucide-react'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { TAIMessage } from '@/types'

export type TWidgetId = 'trending-notes' | 'bitcoin-ticker' | 'ai-prompt' | string // Allow dynamic pinned-note-* and ai-prompt-* IDs

export type TTrendingNotesHeight = 'short' | 'medium' | 'tall' | 'remaining'

export type TBitcoinTickerAlignment = 'left' | 'center'
export type TBitcoinTickerTextSize = 'large' | 'small'

export type TWidget = {
  id: TWidgetId
  name: string
  description: string
  defaultEnabled: boolean
  icon: React.ReactNode
}

export type TPinnedNoteWidget = {
  id: string
  eventId: string
}

export type TAIPromptWidget = {
  id: string
  eventId: string
  messages: TAIMessage[]
}

export const AVAILABLE_WIDGETS: TWidget[] = [
  {
    id: 'tour',
    name: 'Nostr Tour',
    description: 'Interactive onboarding experience explaining Nostr',
    defaultEnabled: true,
    icon: <Compass className="h-5 w-5" />
  },
  {
    id: 'bitcoin-ticker',
    name: 'Bitcoin Ticker',
    description: 'Display real-time Bitcoin price from CoinGecko',
    defaultEnabled: false,
    icon: <Bitcoin className="h-5 w-5" />
  },
  {
    id: 'trending-notes',
    name: 'Trending Notes',
    description: 'Display trending notes from across Nostr',
    defaultEnabled: true,
    icon: <TrendingUp className="h-5 w-5" />
  },
  {
    id: 'ai-prompt',
    name: 'AI Prompt',
    description: 'Chat with AI about notes in your sidebar',
    defaultEnabled: false,
    icon: <Sparkles className="h-5 w-5" />
  }
]

type TWidgetsContext = {
  enabledWidgets: TWidgetId[]
  toggleWidget: (widgetId: TWidgetId) => void
  isWidgetEnabled: (widgetId: TWidgetId) => boolean
  getWidgetById: (widgetId: TWidgetId) => TWidget | undefined
  reorderWidgets: (newOrder: TWidgetId[]) => void
  trendingNotesHeight: TTrendingNotesHeight
  setTrendingNotesHeight: (height: TTrendingNotesHeight) => void
  bitcoinTickerAlignment: TBitcoinTickerAlignment
  setBitcoinTickerAlignment: (alignment: TBitcoinTickerAlignment) => void
  bitcoinTickerTextSize: TBitcoinTickerTextSize
  setBitcoinTickerTextSize: (size: TBitcoinTickerTextSize) => void
  bitcoinTickerShowBlockHeight: boolean
  setBitcoinTickerShowBlockHeight: (show: boolean) => void
  bitcoinTickerShowSatsMode: boolean
  setBitcoinTickerShowSatsMode: (show: boolean) => void
  pinnedNoteWidgets: TPinnedNoteWidget[]
  pinNoteWidget: (eventId: string) => string
  unpinNoteWidget: (widgetId: string) => void
  unpinNoteByEventId: (eventId: string) => void
  isPinned: (eventId: string) => boolean
  aiPromptWidgets: TAIPromptWidget[]
  openAIPrompt: (eventId: string) => string
  closeAIPrompt: (widgetId: string) => void
  closeAIPromptByEventId: (eventId: string) => void
  isAIPromptOpen: (eventId: string) => boolean
  updateAIPromptMessages: (widgetId: string, messages: TAIMessage[]) => void
  getAIPromptWidget: (widgetId: string) => TAIPromptWidget | undefined
}

const WidgetsContext = createContext<TWidgetsContext | undefined>(undefined)

export function WidgetsProvider({ children }: { children: ReactNode }) {
  const [enabledWidgets, setEnabledWidgets] = useState<TWidgetId[]>(() => {
    return localStorageService.getEnabledWidgets() as TWidgetId[]
  })

  const [pinnedNoteWidgets, setPinnedNoteWidgets] = useState<TPinnedNoteWidget[]>(() => {
    return localStorageService.getPinnedNoteWidgets()
  })

  const [aiPromptWidgets, setAIPromptWidgets] = useState<TAIPromptWidget[]>(() => {
    return localStorageService.getAIPromptWidgets()
  })

  const [trendingNotesHeight, setTrendingNotesHeightState] = useState<TTrendingNotesHeight>(() => {
    return localStorageService.getTrendingNotesHeight()
  })

  const [bitcoinTickerAlignment, setBitcoinTickerAlignmentState] = useState<TBitcoinTickerAlignment>(() => {
    return localStorageService.getBitcoinTickerAlignment()
  })

  const [bitcoinTickerTextSize, setBitcoinTickerTextSizeState] = useState<TBitcoinTickerTextSize>(() => {
    return localStorageService.getBitcoinTickerTextSize()
  })

  const [bitcoinTickerShowBlockHeight, setBitcoinTickerShowBlockHeightState] = useState<boolean>(() => {
    return localStorageService.getBitcoinTickerShowBlockHeight()
  })

  const [bitcoinTickerShowSatsMode, setBitcoinTickerShowSatsModeState] = useState<boolean>(() => {
    return localStorageService.getBitcoinTickerShowSatsMode()
  })

  useEffect(() => {
    localStorageService.setEnabledWidgets(enabledWidgets)
  }, [enabledWidgets])

  useEffect(() => {
    localStorageService.setPinnedNoteWidgets(pinnedNoteWidgets)
  }, [pinnedNoteWidgets])

  // AI Prompt widgets are session-only and don't need to persist to localStorage

  useEffect(() => {
    localStorageService.setTrendingNotesHeight(trendingNotesHeight)
  }, [trendingNotesHeight])

  useEffect(() => {
    localStorageService.setBitcoinTickerAlignment(bitcoinTickerAlignment)
  }, [bitcoinTickerAlignment])

  useEffect(() => {
    localStorageService.setBitcoinTickerTextSize(bitcoinTickerTextSize)
  }, [bitcoinTickerTextSize])

  useEffect(() => {
    localStorageService.setBitcoinTickerShowBlockHeight(bitcoinTickerShowBlockHeight)
  }, [bitcoinTickerShowBlockHeight])

  useEffect(() => {
    localStorageService.setBitcoinTickerShowSatsMode(bitcoinTickerShowSatsMode)
  }, [bitcoinTickerShowSatsMode])

  const setTrendingNotesHeight = (height: TTrendingNotesHeight) => {
    setTrendingNotesHeightState(height)
  }

  const setBitcoinTickerAlignment = (alignment: TBitcoinTickerAlignment) => {
    setBitcoinTickerAlignmentState(alignment)
  }

  const setBitcoinTickerTextSize = (size: TBitcoinTickerTextSize) => {
    setBitcoinTickerTextSizeState(size)
  }

  const setBitcoinTickerShowBlockHeight = (show: boolean) => {
    setBitcoinTickerShowBlockHeightState(show)
  }

  const setBitcoinTickerShowSatsMode = (show: boolean) => {
    setBitcoinTickerShowSatsModeState(show)
  }

  const toggleWidget = (widgetId: TWidgetId) => {
    setEnabledWidgets((prev) => {
      if (prev.includes(widgetId)) {
        return prev.filter((id) => id !== widgetId)
      } else {
        return [...prev, widgetId]
      }
    })
  }

  const isWidgetEnabled = (widgetId: TWidgetId) => {
    return enabledWidgets.includes(widgetId)
  }

  const getWidgetById = (widgetId: TWidgetId) => {
    return AVAILABLE_WIDGETS.find((w) => w.id === widgetId)
  }

  const reorderWidgets = (newOrder: TWidgetId[]) => {
    setEnabledWidgets(newOrder)
  }

  const pinNoteWidget = (eventId: string) => {
    const id = localStorageService.addPinnedNoteWidget(eventId)
    setPinnedNoteWidgets((prev) => [...prev, { id, eventId }])
    // Auto-enable the widget
    if (!enabledWidgets.includes(id)) {
      setEnabledWidgets((prev) => [...prev, id])
    }
    return id
  }

  const unpinNoteWidget = (widgetId: string) => {
    localStorageService.removePinnedNoteWidget(widgetId)
    setPinnedNoteWidgets((prev) => prev.filter((w) => w.id !== widgetId))
    // Remove from enabled widgets
    setEnabledWidgets((prev) => prev.filter((id) => id !== widgetId))
  }

  const unpinNoteByEventId = (eventId: string) => {
    const widget = pinnedNoteWidgets.find((w) => w.eventId === eventId)
    if (widget) {
      unpinNoteWidget(widget.id)
    }
  }

  const isPinned = (eventId: string) => {
    return pinnedNoteWidgets.some((w) => w.eventId === eventId)
  }

  const openAIPrompt = (eventId: string) => {
    // Check if there's already an AI prompt widget open
    const existingWidget = aiPromptWidgets[0]

    if (existingWidget) {
      // Replace the existing widget with the new one
      const id = existingWidget.id
      setAIPromptWidgets([{ id, eventId, messages: [] }])
      // Update localStorage
      localStorageService.removeAIPromptWidget(id)
      localStorageService.addAIPromptWidget(eventId, id)
      return id
    } else {
      // Create new widget if none exists
      const id = localStorageService.addAIPromptWidget(eventId)
      setAIPromptWidgets([{ id, eventId, messages: [] }])
      // Auto-enable the widget
      if (!enabledWidgets.includes(id)) {
        setEnabledWidgets((prev) => [...prev, id])
      }
      return id
    }
  }

  const closeAIPrompt = (widgetId: string) => {
    localStorageService.removeAIPromptWidget(widgetId)
    setAIPromptWidgets((prev) => prev.filter((w) => w.id !== widgetId))
    // Remove from enabled widgets
    setEnabledWidgets((prev) => prev.filter((id) => id !== widgetId))
  }

  const closeAIPromptByEventId = (eventId: string) => {
    const widget = aiPromptWidgets.find((w) => w.eventId === eventId)
    if (widget) {
      closeAIPrompt(widget.id)
    }
  }

  const isAIPromptOpen = (eventId: string) => {
    return aiPromptWidgets.some((w) => w.eventId === eventId)
  }

  const updateAIPromptMessages = (widgetId: string, messages: TAIMessage[]) => {
    setAIPromptWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, messages } : w))
    )
  }

  const getAIPromptWidget = (widgetId: string) => {
    return aiPromptWidgets.find((w) => w.id === widgetId)
  }

  return (
    <WidgetsContext.Provider
      value={{
        enabledWidgets,
        toggleWidget,
        isWidgetEnabled,
        getWidgetById,
        reorderWidgets,
        trendingNotesHeight,
        setTrendingNotesHeight,
        bitcoinTickerAlignment,
        setBitcoinTickerAlignment,
        bitcoinTickerTextSize,
        setBitcoinTickerTextSize,
        bitcoinTickerShowBlockHeight,
        setBitcoinTickerShowBlockHeight,
        bitcoinTickerShowSatsMode,
        setBitcoinTickerShowSatsMode,
        pinnedNoteWidgets,
        pinNoteWidget,
        unpinNoteWidget,
        unpinNoteByEventId,
        isPinned,
        aiPromptWidgets,
        openAIPrompt,
        closeAIPrompt,
        closeAIPromptByEventId,
        isAIPromptOpen,
        updateAIPromptMessages,
        getAIPromptWidget
      }}
    >
      {children}
    </WidgetsContext.Provider>
  )
}

export function useWidgets() {
  const context = useContext(WidgetsContext)
  if (!context) {
    throw new Error('useWidgets must be used within a WidgetsProvider')
  }
  return context
}
