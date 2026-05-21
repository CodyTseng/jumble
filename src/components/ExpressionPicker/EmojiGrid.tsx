import { ScrollArea } from '@/components/ui/scroll-area'
import { TNativeEmoji } from '@/lib/native-emoji-data'
import { TEmoji, TSkinTone } from '@/types'
import { useTranslation } from 'react-i18next'
import EmojiCell from './EmojiCell'

export type TEmojiGridSection =
  | { id: string; label?: string; type: 'native'; items: TNativeEmoji[] }
  | { id: string; label?: string; type: 'custom'; items: TEmoji[] }
  | { id: string; label?: string; type: 'mixed'; items: (string | TEmoji)[] }

export default function EmojiGrid({
  sections,
  skinTone,
  onPick,
  emptyText
}: {
  sections: TEmojiGridSection[]
  skinTone: TSkinTone
  onPick: (emoji: string | TEmoji) => void
  emptyText?: string
}) {
  const { t } = useTranslation()
  const totalCount = sections.reduce((acc, s) => acc + s.items.length, 0)

  if (totalCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        {emptyText ?? t('No emojis found')}
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="pb-2">
        {sections.map((section) => (
          <section key={section.id} className="mt-1 first:mt-0">
            {section.label && (
              <div className="sticky top-0 bg-background px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">
                {section.label}
              </div>
            )}
            <div className="grid grid-cols-8 gap-0.5 px-0.5">
              {renderSectionItems(section, skinTone, onPick)}
            </div>
          </section>
        ))}
      </div>
    </ScrollArea>
  )
}

function renderSectionItems(
  section: TEmojiGridSection,
  skinTone: TSkinTone,
  onPick: (emoji: string | TEmoji) => void
) {
  if (section.type === 'native') {
    return section.items.map((e) => (
      <EmojiCell key={e.hexcode} kind="native" native={e} skinTone={skinTone} onClick={onPick} />
    ))
  }
  if (section.type === 'custom') {
    return section.items.map((e) => (
      <EmojiCell key={`${e.shortcode}|${e.url}`} kind="custom" custom={e} onClick={onPick} />
    ))
  }
  return section.items.map((item, idx) =>
    typeof item === 'string' ? (
      <EmojiCell key={`s:${item}:${idx}`} kind="char" char={item} onClick={onPick} />
    ) : (
      <EmojiCell key={`c:${item.shortcode}|${item.url}`} kind="custom" custom={item} onClick={onPick} />
    )
  )
}
