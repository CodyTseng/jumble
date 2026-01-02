import EmojiPackList from '@/components/EmojiPackList'
import NoteList from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { BIG_RELAY_URLS } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { kinds } from 'nostr-tools'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TTab = 'my-packs' | 'explore'

const EmojiPackSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
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
      />
      {tab === 'my-packs' ? (
        <EmojiPackList />
      ) : (
        <NoteList
          showKinds={[kinds.Emojisets]}
          subRequests={[{ urls: BIG_RELAY_URLS, filter: {} }]}
        />
      )}
    </SecondaryPageLayout>
  )
})
EmojiPackSettingsPage.displayName = 'EmojiPackSettingsPage'
export default EmojiPackSettingsPage
