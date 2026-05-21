import { cn } from '@/lib/utils'
import { Clock, Flame, Heart, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type TGifTabId = 'trending' | 'favorites' | 'recent'

const tabClass =
  'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

export default function GifTabs({
  activeTabId,
  onChange,
  onSearchClick
}: {
  activeTabId: TGifTabId
  onChange: (id: TGifTabId) => void
  onSearchClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
      <Tab isActive={false} onClick={onSearchClick} title={t('Search GIFs')}>
        <Search className="size-5" />
      </Tab>
      <Tab
        isActive={activeTabId === 'recent'}
        onClick={() => onChange('recent')}
        title={t('Recent')}
      >
        <Clock className="size-5" />
      </Tab>
      <Tab
        isActive={activeTabId === 'trending'}
        onClick={() => onChange('trending')}
        title={t('Trending')}
      >
        <Flame className="size-5" />
      </Tab>
      <Tab
        isActive={activeTabId === 'favorites'}
        onClick={() => onChange('favorites')}
        title={t('Favorites')}
      >
        <Heart className="size-5" />
      </Tab>
    </div>
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
