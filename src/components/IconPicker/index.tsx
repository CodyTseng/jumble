import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Search } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'

// Get all icon names from lucide-react, excluding non-icon exports
const getAllIconNames = (): string[] => {
  return Object.keys(LucideIcons)
    .filter((key) => {
      // Filter out non-icon exports like 'createLucideIcon', 'Icon', etc.
      return (
        !key.startsWith('create') &&
        !key.startsWith('default') &&
        key !== 'Icon' &&
        key !== 'icons' &&
        typeof (LucideIcons as any)[key] === 'function'
      )
    })
    .sort()
}

// Popular/commonly used icons for quick access
const POPULAR_ICONS = [
  'Sparkles',
  'Star',
  'Heart',
  'Home',
  'Settings',
  'User',
  'Mail',
  'Calendar',
  'Clock',
  'Bookmark',
  'Bell',
  'MessageSquare',
  'Image',
  'Video',
  'Music',
  'File',
  'Folder',
  'Download',
  'Upload',
  'Share',
  'TrendingUp',
  'Activity',
  'Award',
  'Target',
  'Zap',
  'Sun',
  'Moon',
  'Cloud',
  'Umbrella',
  'Coffee',
  'Pizza',
  'Gift',
  'ShoppingCart',
  'CreditCard',
  'DollarSign',
  'Bitcoin',
  'Palette',
  'Compass',
  'Map',
  'Navigation',
  'Rocket',
  'Flame',
  'Smile',
  'ThumbsUp',
  'Eye',
  'Lock',
  'Key',
  'Shield',
  'AlertCircle',
  'Info',
  'CheckCircle',
  'XCircle'
]

type IconPickerProps = {
  selectedIcon?: string
  onIconSelect: (iconName: string | null) => void
  onClose?: () => void
}

export default function IconPicker({ selectedIcon, onIconSelect, onClose }: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const allIcons = useMemo(() => getAllIconNames(), [])

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return POPULAR_ICONS
    }
    const query = searchQuery.toLowerCase()
    return allIcons.filter((name) => name.toLowerCase().includes(query))
  }, [searchQuery, allIcons])

  const renderIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName]
    if (!IconComponent) return null
    return <IconComponent className="h-5 w-5" />
  }

  const handleIconClick = (iconName: string) => {
    onIconSelect(iconName)
    onClose?.()
  }

  const handleClearIcon = () => {
    onIconSelect(null)
    onClose?.()
  }

  return (
    <div className="flex flex-col h-full max-h-[500px] w-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Choose an Icon</h3>
          {selectedIcon && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearIcon}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Remove Icon
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {searchQuery ? `${filteredIcons.length} icons found` : 'Showing popular icons'}
        </p>
      </div>

      {/* Icon Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredIcons.length > 0 ? (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {filteredIcons.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => handleIconClick(iconName)}
                  className={cn(
                    'flex items-center justify-center h-12 w-12 rounded-lg border-2 transition-all hover:bg-accent hover:border-primary/50',
                    selectedIcon === iconName
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  )}
                  title={iconName}
                >
                  {renderIcon(iconName)}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No icons found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
