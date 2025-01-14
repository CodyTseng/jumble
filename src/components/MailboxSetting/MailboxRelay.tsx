import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { TMailboxRelay, TMailboxRelayScope } from '@/types'
import { CircleX, Server } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function MailboxRelay({
  mailboxRelay,
  changeMailboxRelayScope,
  removeMailboxRelay
}: {
  mailboxRelay: TMailboxRelay
  changeMailboxRelayScope: (url: string, scope: TMailboxRelayScope) => void
  removeMailboxRelay: (url: string) => void
}) {
  const { t } = useTranslation()
  const relayIcon = useMemo(() => {
    const url = new URL(mailboxRelay.url)
    return `${url.protocol === 'wss:' ? 'https:' : 'http:'}//${url.host}/favicon.ico`
  }, [mailboxRelay.url])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1 w-0">
        <Avatar className="w-6 h-6">
          <AvatarImage src={relayIcon} />
          <AvatarFallback>
            <Server size={14} />
          </AvatarFallback>
        </Avatar>
        <div className="truncate">{mailboxRelay.url}</div>
      </div>
      <div className="flex items-center gap-4">
        <Select
          value={mailboxRelay.scope}
          onValueChange={(v: TMailboxRelayScope) => changeMailboxRelayScope(mailboxRelay.url, v)}
        >
          <SelectTrigger className="w-24 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">{t('R & W')}</SelectItem>
            <SelectItem value="read">{t('Read')}</SelectItem>
            <SelectItem value="write">{t('Write')}</SelectItem>
          </SelectContent>
        </Select>
        <CircleX
          size={16}
          onClick={() => removeMailboxRelay(mailboxRelay.url)}
          className="text-muted-foreground hover:text-destructive clickable"
        />
      </div>
    </div>
  )
}
