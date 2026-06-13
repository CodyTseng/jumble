import EmojiPackList from '@/components/EmojiPackList'
import NoteList from '@/components/NoteList'
import StandaloneEmojiManager from '@/components/StandaloneEmojiManager'
import Tabs from '@/components/Tabs'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toEmojiSetEditor } from '@/lib/link'
import { getDefaultRelayUrls } from '@/lib/relay'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { PlusIcon } from 'lucide-react'
import { kinds } from 'nostr-tools'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TTab = 'my-packs' | 'explore'

const EmojiPackSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { checkLogin } = useNostr()
  const [tab, setTab] = useState<TTab>('my-packs')

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Emoji Packs')} displayScrollToTopButton>
      <Tabs
        value={tab}
        tabs={[
          { value: 'my-packs', label: 'My Packs' },
          { value: 'explore', label: 'Explore' }
        ]}
        onTabChange={(tab) => {
          setTab(tab as TTab)
        }}
        options={
          tab === 'my-packs' ? (
            <Button
              variant="ghost"
              size="titlebar-icon"
              className="text-muted-foreground focus:text-foreground w-auto gap-1 px-3"
              onClick={() => checkLogin(() => push(toEmojiSetEditor()))}
            >
              <PlusIcon />
              {t('Create emoji set')}
            </Button>
          ) : null
        }
      />
      {tab === 'my-packs' ? (
        <div>
          <StandaloneEmojiManager className="border-b p-4" />
          <EmojiPackList />
        </div>
      ) : (
        <NoteList
          showKinds={[kinds.Emojisets]}
          subRequests={[{ urls: getDefaultRelayUrls(), filter: {} }]}
          hideSpam
        />
      )}
    </SecondaryPageLayout>
  )
})
EmojiPackSettingsPage.displayName = 'EmojiPackSettingsPage'
export default EmojiPackSettingsPage
