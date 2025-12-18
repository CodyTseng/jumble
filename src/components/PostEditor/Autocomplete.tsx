import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import nostrListsService, { NostrList } from '@/services/nostr-lists.service'
import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

interface AutocompleteProps {
  query: string
  onSelect: (item: AutocompleteItem) => void
  position: { top: number; left: number }
  visible: boolean
}

interface AutocompleteItem {
  type: 'user' | 'list'
  id: string
  display: string
  data: any
}

export default function Autocomplete({ query, onSelect, position, visible }: AutocompleteProps) {
  const { pubkey } = useNostr()
  const [items, setItems] = useState<AutocompleteItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (!visible || !query) {
      setItems([])
      return
    }

    const searchItems = async () => {
      const results: AutocompleteItem[] = []
      
      // Search user lists if query starts with @
      if (query.startsWith('@') && pubkey) {
        const searchQuery = query.slice(1).toLowerCase()
        const userLists = await nostrListsService.fetchUserLists(pubkey)
        const matchingLists = userLists.filter(list => 
          list.name.toLowerCase().includes(searchQuery)
        )
        
        matchingLists.forEach(list => {
          results.push({
            type: 'list',
            id: list.id,
            display: `@${list.name}`,
            data: list
          })
        })
      }

      setItems(results.slice(0, 5)) // Limit to 5 items
      setSelectedIndex(0)
    }

    searchItems()
  }, [query, visible, pubkey])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || items.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % items.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + items.length) % items.length)
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setItems([])
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, items, selectedIndex, onSelect])

  if (!visible || items.length === 0) {
    return null
  }

  return (
    <div
      className="absolute z-50 bg-background border rounded-md shadow-lg max-w-xs"
      style={{ top: position.top, left: position.left }}
    >
      {items.map((item, index) => (
        <div
          key={`${item.type}-${item.id}`}
          className={cn(
            'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted',
            selectedIndex === index && 'bg-muted'
          )}
          onClick={() => onSelect(item)}
        >
          {item.type === 'list' ? (
            <>
              <div className="flex items-center justify-center size-6 shrink-0 bg-muted rounded-full">
                <Users className="size-3" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm truncate">{item.data.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.data.pubkeys.length} users
                </span>
              </div>
            </>
          ) : (
            <>
              <SimpleUserAvatar userId={item.id} size="small" />
              <SimpleUsername userId={item.id} className="font-medium text-sm truncate" />
            </>
          )}
        </div>
      ))}
    </div>
  )
}
