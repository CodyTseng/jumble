import { SecondaryPageLink } from '@renderer/PageManager'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import {
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList
} from '@renderer/components/ui/command'
import { useSearchProfiles } from '@renderer/hooks'
import { isMacOS } from '@renderer/lib/env'
import { toNote, toNoteList, toProfile, toProfileList } from '@renderer/lib/link'
import { generateImageByPubkey } from '@renderer/lib/pubkey'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'
import { TProfile } from '@renderer/types'
import { Hash, Notebook, UserRound } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { Dispatch, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function SearchDialog({ open, setOpen }: { open: boolean; setOpen: Dispatch<boolean> }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [debouncedInput, setDebouncedInput] = useState(input)
  const { profiles } = useSearchProfiles(debouncedInput, 10)

  const list = useMemo(() => {
    const search = input.trim()
    if (!search) return

    if (/^[0-9a-f]{64}$/.test(search)) {
      return (
        <>
          <NoteItem id={search} onClick={() => setOpen(false)} />
          <ProfileIdItem id={search} onClick={() => setOpen(false)} />
        </>
      )
    }

    try {
      let id = search
      if (id.startsWith('nostr:')) {
        id = id.slice(6)
      }
      const { type } = nip19.decode(id)
      if (['nprofile', 'npub'].includes(type)) {
        return <ProfileIdItem id={id} onClick={() => setOpen(false)} />
      }
      if (['nevent', 'naddr', 'note'].includes(type)) {
        return <NoteItem id={id} onClick={() => setOpen(false)} />
      }
    } catch {
      // ignore
    }

    return (
      <>
        <NormalItem search={search} onClick={() => setOpen(false)} />
        <HashtagItem search={search} onClick={() => setOpen(false)} />
        {profiles.map((profile) => (
          <ProfileItem key={profile.pubkey} profile={profile} onClick={() => setOpen(false)} />
        ))}
        {profiles.length >= 10 && (
          <SecondaryPageLink to={toProfileList({ search })} onClick={() => setOpen(false)}>
            <CommandItem onClick={() => setOpen(false)} className="text-center">
              <div className="font-semibold">{t('Show more...')}</div>
            </CommandItem>
          </SecondaryPageLink>
        )}
      </>
    )
  }, [input, profiles])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInput(input)
    }, 500)

    return () => {
      clearTimeout(handler)
    }
  }, [input])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      classNames={{ content: isMacOS() ? 'max-sm:top-9' : 'max-sm:top-0' }}
    >
      <CommandInput value={input} onValueChange={setInput} />
      <CommandList>{list}</CommandList>
    </CommandDialog>
  )
}

function NormalItem({ search, onClick }: { search: string; onClick?: () => void }) {
  const { searchableRelayUrls } = useRelaySettings()

  if (searchableRelayUrls.length === 0) {
    return null
  }

  return (
    <SecondaryPageLink to={toNoteList({ search })} onClick={onClick}>
      <CommandItem>
        <Notebook className="text-muted-foreground" />
        <div className="font-semibold">{search}</div>
      </CommandItem>
    </SecondaryPageLink>
  )
}

function HashtagItem({ search, onClick }: { search: string; onClick?: () => void }) {
  const hashtag = search.match(/[\p{L}\p{N}\p{M}]+/u)?.[0].toLowerCase()
  return (
    <SecondaryPageLink to={toNoteList({ hashtag })} onClick={onClick}>
      <CommandItem value={`hashtag-${hashtag}`}>
        <Hash className="text-muted-foreground" />
        <div className="font-semibold">{hashtag}</div>
      </CommandItem>
    </SecondaryPageLink>
  )
}

function NoteItem({ id, onClick }: { id: string; onClick?: () => void }) {
  return (
    <SecondaryPageLink to={toNote(id)} onClick={onClick}>
      <CommandItem>
        <Notebook className="text-muted-foreground" />
        <div className="font-semibold truncate">{id}</div>
      </CommandItem>
    </SecondaryPageLink>
  )
}

function ProfileIdItem({ id, onClick }: { id: string; onClick?: () => void }) {
  return (
    <SecondaryPageLink to={toProfile(id)} onClick={onClick}>
      <CommandItem>
        <UserRound className="text-muted-foreground" />
        <div className="font-semibold truncate">{id}</div>
      </CommandItem>
    </SecondaryPageLink>
  )
}

function ProfileItem({ profile, onClick }: { profile: TProfile; onClick?: () => void }) {
  return (
    <SecondaryPageLink to={toProfile(profile.pubkey)} onClick={onClick}>
      <CommandItem>
        <div className="flex gap-2">
          <Avatar>
            <AvatarImage src={profile.avatar} alt={profile.username} />
            <AvatarFallback>
              <img src={generateImageByPubkey(profile.pubkey)} alt={profile.username} />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{profile.username}</div>
            <div className="line-clamp-1 text-muted-foreground">{profile.about}</div>
          </div>
        </div>
      </CommandItem>
    </SecondaryPageLink>
  )
}
