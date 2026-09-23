import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsRow } from '@/components/ui/settings'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Visibility = 'public' | 'private'

export default function MutedWords() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { publicMutedWords, privateMutedWords, refreshMuteWords } = useMuteList()

  useEffect(() => {
    refreshMuteWords()
  }, [pubkey])

  return (
    <SettingsRow layout="stacked" title={<span className="font-medium">{t('Muted words')}</span>}>
      <div className="space-y-5">
        {!pubkey && <p className="text-muted-foreground text-sm">{t('You need to login first')}</p>}
        <MutedWordSection visibility="private" words={privateMutedWords} />
        <MutedWordSection visibility="public" words={publicMutedWords} />
      </div>
    </SettingsRow>
  )
}

function MutedWordSection({ visibility, words }: { visibility: Visibility; words: string[] }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const {
    changing,
    addMuteWord,
    removeMuteWord,
    mutedWordsMigrationFailed,
    retryMutedWordsMigration
  } = useMuteList()
  const [newWord, setNewWord] = useState('')
  const sectionLabel = t(visibility === 'private' ? 'Private' : 'Public')
  const wordLabel = t(visibility === 'private' ? 'Private muted word' : 'Public muted word')
  const normalizedWord = newWord.trim().toLowerCase()

  const handleAdd = async () => {
    if (!pubkey || !normalizedWord || words.includes(normalizedWord) || changing) return
    if (await addMuteWord(normalizedWord, visibility)) setNewWord('')
  }

  return (
    <section className="space-y-2" aria-label={sectionLabel}>
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide">
        {sectionLabel}
        {visibility === 'public' && (
          <span className="font-normal">{t('(Visible to everyone)')}</span>
        )}
      </h3>
      {visibility === 'private' && mutedWordsMigrationFailed && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          <span>{t('Local muted words have not synced yet.')}</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={retryMutedWordsMigration}
            disabled={changing}
          >
            {t('Retry')}
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder={t('Add muted word')}
          aria-label={wordLabel}
          value={newWord}
          onChange={(event) => setNewWord(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            handleAdd()
          }}
          className="min-w-0 flex-1"
          disabled={!pubkey || changing}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAdd}
          disabled={!pubkey || changing || !normalizedWord || words.includes(normalizedWord)}
          aria-label={`${t('Add muted word')} (${sectionLabel})`}
        >
          <Plus />
        </Button>
      </div>
      {words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {words.map((word) => (
            <div
              key={word}
              className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-sm"
            >
              <span dir="auto">{word}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-transparent"
                onClick={() => removeMuteWord(word, visibility)}
                disabled={changing}
                aria-label={`${t('Remove muted word')}: ${word}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
