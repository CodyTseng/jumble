import { Badge } from '@/components/ui/badge'
import { getNoteBech32Id } from '@/lib/event'
import {
  Nip34EventMetadata,
  Nip34EventType,
  getGitWorkshopRepositoryUrl,
  getGitWorkshopUrl,
  getNip34EventMetadata
} from '@/lib/nip34'
import { cn } from '@/lib/utils'
import {
  BookMarked,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  CodeXml,
  FileDiff,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  ListTree,
  Server
} from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Content from '../Content'
import { EmbeddedWebsocketUrl } from '../Embedded'

function TypeIcon({ type }: { type: Nip34EventType }) {
  const className = 'mt-0.5 size-5 shrink-0'
  switch (type) {
    case 'repository':
      return <BookMarked className={className} />
    case 'repository-state':
      return <ListTree className={className} />
    case 'patch':
      return <FileDiff className={className} />
    case 'pull-request':
    case 'pull-request-update':
      return <GitPullRequest className={className} />
    case 'issue':
      return <CircleDot className={className} />
    case 'status-open':
      return <CircleDot className={cn(className, 'text-green-500')} />
    case 'status-applied':
      return <CircleCheck className={cn(className, 'text-purple-500')} />
    case 'status-closed':
      return <CircleX className={cn(className, 'text-red-500')} />
    case 'status-draft':
      return <CircleDashed className={cn(className, 'text-muted-foreground')} />
    case 'grasp-list':
      return <Server className={className} />
  }
}

function shortValue(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-7)}` : value
}

function RepositoryInfo({ repositoryId, href }: { repositoryId: string; href?: string }) {
  const content = (
    <>
      <BookMarked className="size-4 shrink-0" />
      <span dir="auto" className="font-mono break-all">
        {repositoryId}
      </span>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-muted-foreground hover:text-foreground flex w-fit max-w-full items-center gap-1.5 text-sm underline-offset-4 hover:underline"
      >
        {content}
      </a>
    )
  }

  return (
    <div className="text-muted-foreground flex max-w-full items-center gap-1.5 text-sm">
      {content}
    </div>
  )
}

function Heading({
  metadata,
  href,
  repositoryHref
}: {
  metadata: Nip34EventMetadata
  href?: string
  repositoryHref?: string
}) {
  const showRepository =
    !!metadata.repositoryId &&
    metadata.type !== 'repository' &&
    metadata.type !== 'repository-state'

  return (
    <div className="space-y-1">
      {showRepository && (
        <RepositoryInfo repositoryId={metadata.repositoryId!} href={repositoryHref} />
      )}
      <div className="flex min-w-0 items-start gap-2">
        <TypeIcon type={metadata.type} />
        {metadata.title && href && (
          <div dir="auto" className="min-w-0 flex-1 font-semibold wrap-break-word">
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-4 hover:underline"
            >
              {metadata.title}
            </a>
          </div>
        )}
        {metadata.title && !href && (
          <div dir="auto" className="min-w-0 flex-1 font-semibold wrap-break-word">
            {metadata.title}
          </div>
        )}
      </div>
    </div>
  )
}

function BranchLabel({ branchName }: { branchName?: string }) {
  if (!branchName) return null
  return (
    <div className="text-muted-foreground flex max-w-full shrink-0 items-center gap-1.5 text-sm">
      <GitBranch className="size-4 shrink-0" />
      <span dir="auto" className="font-mono break-all">
        {branchName}
      </span>
    </div>
  )
}

function CommitLabel({ value }: { value?: string }) {
  const { t } = useTranslation()
  if (!value) return null
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
      <GitCommitHorizontal className="size-4 shrink-0" />
      <span className="shrink-0">{t('Commit')}</span>
      <code className="truncate" title={value}>
        {shortValue(value)}
      </code>
    </div>
  )
}

function WebsocketList({ urls }: { urls: string[] }) {
  return urls.length > 0 ? (
    <div className="flex flex-col items-start gap-1 text-sm">
      {urls.map((url, index) => (
        <EmbeddedWebsocketUrl key={`${url}-${index}`} url={url} />
      ))}
    </div>
  ) : null
}

function Labels({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label, index) => (
        <Badge key={`${label}-${index}`} variant="secondary" dir="auto">
          {label}
        </Badge>
      ))}
    </div>
  )
}

function RepositoryContent({ metadata }: { metadata: Nip34EventMetadata }) {
  return (
    <>
      {metadata.description && (
        <div dir="auto" className="text-muted-foreground text-sm wrap-break-word">
          {metadata.description}
        </div>
      )}
      <Labels labels={metadata.labels} />
    </>
  )
}

function RepositoryStateContent({ metadata }: { metadata: Nip34EventMetadata }) {
  const { t } = useTranslation()
  return (
    <>
      {metadata.head && (
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
          <GitBranch className="size-4 shrink-0" />
          <span className="shrink-0">HEAD</span>
          <code className="truncate">{metadata.head}</code>
        </div>
      )}
      {metadata.refs.length > 0 && (
        <div className="bg-muted/50 max-h-64 space-y-1 overflow-auto rounded-md p-2 text-xs">
          <div className="text-muted-foreground font-medium">{t('Branches and tags')}</div>
          {metadata.refs.map(({ name, commit }, index) => (
            <div className="flex min-w-0 justify-between gap-3" key={`${name}-${index}`}>
              <code dir="auto" className="truncate">
                {name.replace(/^refs\//, '')}
              </code>
              <code className="text-muted-foreground shrink-0" title={commit}>
                {shortValue(commit)}
              </code>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function DiscussionContent({ event, metadata }: { event: Event; metadata: Nip34EventMetadata }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <BranchLabel branchName={metadata.branchName} />
        <Labels labels={metadata.labels} />
      </div>
      {event.content && <Content event={event} />}
    </>
  )
}

function UpdateContent({ metadata }: { metadata: Nip34EventMetadata }) {
  const { t } = useTranslation()
  return (
    <>
      {metadata.targetEventId && (
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
          <GitPullRequest className="size-4 shrink-0" />
          <span className="shrink-0">{t('Pull request')}</span>
          <code className="truncate" title={metadata.targetEventId}>
            {shortValue(metadata.targetEventId)}
          </code>
        </div>
      )}
    </>
  )
}

function StatusContent({ event, metadata }: { event: Event; metadata: Nip34EventMetadata }) {
  const { t } = useTranslation()
  return (
    <>
      {metadata.targetEventId && (
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
          <CodeXml className="size-4 shrink-0" />
          <span className="shrink-0">{t('Target')}</span>
          <code className="truncate" title={metadata.targetEventId}>
            {shortValue(metadata.targetEventId)}
          </code>
        </div>
      )}
      <CommitLabel value={metadata.mergeCommit} />
      {metadata.appliedCommits.map((commit, index) => (
        <CommitLabel key={`${commit}-${index}`} value={commit} />
      ))}
      {event.content && <Content event={event} />}
    </>
  )
}

export default function Nip34Event({ event, className }: { event: Event; className?: string }) {
  const metadata = useMemo(() => getNip34EventMetadata(event), [event])
  const gitWorkshopUrl = useMemo(() => getGitWorkshopUrl(event, getNoteBech32Id(event)), [event])
  const gitWorkshopRepositoryUrl = useMemo(() => getGitWorkshopRepositoryUrl(event), [event])
  if (!metadata) return null

  let body: React.ReactNode
  switch (metadata.type) {
    case 'repository':
      body = <RepositoryContent metadata={metadata} />
      break
    case 'repository-state':
      body = <RepositoryStateContent metadata={metadata} />
      break
    case 'patch':
      body = null
      break
    case 'pull-request':
    case 'issue':
      body = <DiscussionContent event={event} metadata={metadata} />
      break
    case 'pull-request-update':
      body = <UpdateContent metadata={metadata} />
      break
    case 'grasp-list':
      body = <WebsocketList urls={metadata.graspUrls} />
      break
    default:
      body = <StatusContent event={event} metadata={metadata} />
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Heading
        metadata={metadata}
        href={gitWorkshopUrl}
        repositoryHref={gitWorkshopRepositoryUrl}
      />
      {body}
    </div>
  )
}
