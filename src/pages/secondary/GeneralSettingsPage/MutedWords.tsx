import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SettingItem from './SettingItem'

export default function MutedWords() {
  const { t } = useTranslation()
  const { mutedWords, setMutedWords } = useContentPolicy()
  const [newMutedWord, setNewMutedWord] = useState('')

  const handleAddMutedWord = () => {
    const word = newMutedWord.trim().toLowerCase()
    if (word && !mutedWords.includes(word)) {
      setMutedWords([...mutedWords, word])
      setNewMutedWord('')
    }
  }

  const handleRemoveMutedWord = (word: string) => {
    setMutedWords(mutedWords.filter((w) => w !== word))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddMutedWord()
    }
  }

  return (
    <SettingItem className="flex-col items-start gap-2">
      <Label className="text-base font-normal">{t('Muted words')}</Label>
      <div className="w-full space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder={t('Add muted word')}
            value={newMutedWord}
            onChange={(e) => setNewMutedWord(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleAddMutedWord}
            disabled={!newMutedWord.trim() || mutedWords.includes(newMutedWord.trim())}
          >
            <Plus />
          </Button>
        </div>
        {mutedWords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mutedWords.map((word) => (
              <div
                key={word}
                className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm"
              >
                <span>{word}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => handleRemoveMutedWord(word)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingItem>
  )
}
