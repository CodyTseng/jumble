import UserItem from '@/components/UserItem'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useFetchProfile } from '@/hooks'
import { TFollowSet } from '@/lib/follow-set'
import { formatPubkey, isValidPubkey, userIdToPubkey } from '@/lib/pubkey'
import { useFollowList } from '@/providers/FollowListProvider'
import { Loader } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function FollowListEditor({
  set,
  onCancel,
  onSave
}: {
  set?: TFollowSet
  onCancel: () => void
  onSave: (name: string, pubkeys: string[]) => Promise<'saved' | 'changed' | 'unverified'>
}) {
  const { t } = useTranslation()
  const { followingSet } = useFollowList()
  const [name, setName] = useState(set?.name ?? '')
  const [pubkeys, setPubkeys] = useState(() => new Set(set?.pubkeys))
  const [identifier, setIdentifier] = useState('')
  const [identifierError, setIdentifierError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveConflict, setSaveConflict] = useState(false)
  const savingRef = useRef(false)
  const candidates = useMemo(() => {
    return Array.from(new Set([...(set?.pubkeys ?? []), ...followingSet]))
  }, [set, followingSet])
  const [added, setAdded] = useState<string[]>([])
  const [visibleCount, setVisibleCount] = useState(20)
  const memberInputId = useId()

  const toggleMember = (pubkey: string, checked: boolean) => {
    setPubkeys((current) => {
      const next = new Set(current)
      if (checked) next.add(pubkey)
      else next.delete(pubkey)
      return next
    })
  }

  const addMember = () => {
    const value = identifier
      .trim()
      .replace(/^nostr:/i, '')
      .toLowerCase()
    let pubkey: string
    try {
      pubkey = userIdToPubkey(value, true)
    } catch {
      setIdentifierError(true)
      return
    }
    if (!isValidPubkey(pubkey)) {
      setIdentifierError(true)
      return
    }
    setAdded((current) => [pubkey, ...current.filter((key) => key !== pubkey)])
    toggleMember(pubkey, true)
    setIdentifier('')
    setIdentifierError(false)
  }

  const save = async () => {
    if (!name.trim() || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const result = await onSave(name.trim(), Array.from(pubkeys))
      if (result === 'changed') setSaveConflict(true)
      if (result === 'unverified') toast.error(t('Try again later or check your connection'))
    } catch (error) {
      console.warn('Could not save follow list', error)
      toast.error(t('Failed'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <label className="block space-y-1.5 text-sm font-medium">
        <span>{t('Follow list name')}</span>
        <Input
          dir="auto"
          value={name}
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p className="text-muted-foreground text-sm">
        {t('Anyone can see the people you add to this list.')}
      </p>
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          addMember()
        }}
      >
        <label htmlFor={memberInputId} className="text-sm font-medium">
          {t('Nostr public key')}
        </label>
        <div className="flex gap-2">
          <Input
            id={memberInputId}
            dir="ltr"
            value={identifier}
            placeholder="npub…"
            disabled={saving}
            aria-invalid={identifierError}
            onChange={(e) => {
              setIdentifier(e.target.value)
              setIdentifierError(false)
            }}
          />
          <Button type="submit" variant="outline" disabled={saving || !identifier.trim()}>
            {t('Add')}
          </Button>
        </div>
        {identifierError && (
          <p role="alert" className="text-destructive text-sm">
            {t('Invalid Nostr public key')}
          </p>
        )}
      </form>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <Button disabled={saving || saveConflict || !name.trim()} onClick={() => void save()}>
          {saving && <Loader className="animate-spin" />}
          {t('Save')}
        </Button>
      </div>
      {saveConflict && (
        <p role="alert" className="text-destructive text-sm">
          {t('This follow list was changed or deleted. Reopen it to see the latest version.')}
        </p>
      )}
      <div className="divide-y border-t">
        {Array.from(new Set([...added, ...candidates.slice(0, visibleCount)])).map((pubkey) => (
          <MemberOption
            key={pubkey}
            pubkey={pubkey}
            checked={pubkeys.has(pubkey)}
            disabled={saving}
            onCheckedChange={(checked) => toggleMember(pubkey, checked === true)}
          />
        ))}
      </div>
      {visibleCount < candidates.length && (
        <Button variant="outline" onClick={() => setVisibleCount((count) => count + 20)}>
          {t('Show more')}
        </Button>
      )}
    </div>
  )
}

function MemberOption({
  pubkey,
  checked,
  disabled,
  onCheckedChange
}: {
  pubkey: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean | 'indeterminate') => void
}) {
  const { profile } = useFetchProfile(pubkey)
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        aria-label={profile?.username || formatPubkey(pubkey)}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <UserItem userId={pubkey} hideFollowButton className="min-w-0 flex-1" />
    </div>
  )
}
