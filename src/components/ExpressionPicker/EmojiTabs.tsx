import Emoji from '@/components/Emoji'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { TEmoji, TEmojiPack } from '@/types'
import { Search, Smile, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type TEmojiTabId = 'system' | 'standalone' | string

const tabClass =
  'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

export default function EmojiTabs({
  activeTabId,
  onChange,
  onSearchClick,
  showStandalone,
  packs
}: {
  activeTabId: TEmojiTabId
  onChange: (id: TEmojiTabId) => void
  onSearchClick: () => void
  showStandalone: boolean
  packs: TEmojiPack[]
}) {
  const { t } = useTranslation()
  return (
    <ScrollArea className="border-b" scrollBarClassName="h-1.5">
      <div className="flex items-center gap-0.5 px-1.5 py-1">
        <Tab isActive={false} onClick={onSearchClick} title={t('Search emojis')}>
          <Search className="size-5" />
        </Tab>
        <Tab
          isActive={activeTabId === 'system'}
          onClick={() => onChange('system')}
          title={t('Smileys & Emotion')}
        >
          <Smile className="size-5" />
        </Tab>
        {showStandalone && (
          <Tab
            isActive={activeTabId === 'standalone'}
            onClick={() => onChange('standalone')}
            title={t('My emojis')}
          >
            <Star className="size-5" />
          </Tab>
        )}
        {packs.map((pack) => (
          <Tab
            key={pack.id}
            isActive={activeTabId === pack.id}
            onClick={() => onChange(pack.id)}
            title={pack.title ?? pack.id}
          >
            <PackIcon emoji={pack.emojis[0]} />
          </Tab>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="pointer-events-none opacity-0" />
    </ScrollArea>
  )
}

function Tab({
  isActive,
  onClick,
  title,
  children
}: {
  isActive: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(tabClass, isActive && 'bg-muted text-foreground')}
    >
      {children}
    </button>
  )
}

function PackIcon({ emoji }: { emoji: TEmoji | undefined }) {
  if (!emoji) return <Star className="size-7" />
  return <Emoji emoji={emoji} classNames={{ img: 'size-7 rounded' }} />
}
