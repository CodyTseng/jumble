import { ExtendedKind, NIP_34_KINDS } from '@/constants'
import { Event, nip19 } from 'nostr-tools'

export type Nip34EventType =
  | 'repository'
  | 'repository-state'
  | 'patch'
  | 'pull-request'
  | 'pull-request-update'
  | 'issue'
  | 'status-open'
  | 'status-applied'
  | 'status-closed'
  | 'status-draft'
  | 'grasp-list'

export type Nip34EventMetadata = {
  type: Nip34EventType
  title: string
  repositoryId?: string
  repositoryPubkey?: string
  repositoryRelay?: string
  description?: string
  labels: string[]
  webUrls: string[]
  cloneUrls: string[]
  relayUrls: string[]
  graspUrls: string[]
  maintainers: string[]
  refs: { name: string; commit: string }[]
  head?: string
  commit?: string
  mergeCommit?: string
  appliedCommits: string[]
  branchName?: string
  targetEventId?: string
}

export const NIP_34_TYPE_LABELS: Record<Nip34EventType, string> = {
  repository: 'Repository',
  'repository-state': 'Repository state',
  patch: 'Patch',
  'pull-request': 'Pull request',
  'pull-request-update': 'Pull request update',
  issue: 'Issue',
  'status-open': 'Open',
  'status-applied': 'Applied / merged / resolved',
  'status-closed': 'Closed',
  'status-draft': 'Draft',
  'grasp-list': 'Grasp servers'
}

const STATUS_TYPES: Partial<Record<number, Nip34EventType>> = {
  [ExtendedKind.GIT_STATUS_OPEN]: 'status-open',
  [ExtendedKind.GIT_STATUS_APPLIED]: 'status-applied',
  [ExtendedKind.GIT_STATUS_CLOSED]: 'status-closed',
  [ExtendedKind.GIT_STATUS_DRAFT]: 'status-draft'
}

export function isNip34EventKind(kind: number): boolean {
  return NIP_34_KINDS.includes(kind)
}

function getTagValues(event: Event, name: string): string[] {
  return event.tags
    .filter((tag) => tag[0] === name && tag[1])
    .flatMap((tag) => tag.slice(1).filter(Boolean))
}

function getFirstTagValue(event: Event, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1] || undefined
}

function getRepositoryCoordinate(
  event: Event
): { id: string; pubkey: string; relay?: string } | undefined {
  const address = getFirstTagValue(event, 'a')
  if (address) {
    const [kind, pubkey, ...identifierParts] = address.split(':')
    if (Number(kind) === ExtendedKind.GIT_REPOSITORY && identifierParts.length > 0) {
      const tag = event.tags.find((item) => item[0] === 'a' && item[1] === address)
      return {
        id: identifierParts.join(':'),
        pubkey,
        relay: tag?.[2] || undefined
      }
    }
  }

  if (
    event.kind === ExtendedKind.GIT_REPOSITORY ||
    event.kind === ExtendedKind.GIT_REPOSITORY_STATE
  ) {
    const id = getFirstTagValue(event, 'd')
    if (id) {
      return {
        id,
        pubkey: event.pubkey,
        relay: getTagValues(event, 'relays')[0]
      }
    }
  }

  return undefined
}

function getFirstContentLine(content: string): string | undefined {
  const line = content
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean)
  return line?.replace(/^#{1,6}\s+/, '')
}

export function getPatchSubject(event: Event): string | undefined {
  const taggedSubject = getFirstTagValue(event, 'subject')
  if (taggedSubject) return taggedSubject

  const match = event.content.match(/^Subject:\s*(.+(?:\n[ \t].+)*)/im)
  if (!match) return undefined

  return match[1]
    .replace(/\n[ \t]+/g, ' ')
    .replace(/^\[PATCH[^\]]*\]\s*/i, '')
    .trim()
}

function getEventType(kind: number): Nip34EventType | undefined {
  if (kind === ExtendedKind.GIT_REPOSITORY) return 'repository'
  if (kind === ExtendedKind.GIT_REPOSITORY_STATE) return 'repository-state'
  if (kind === ExtendedKind.GIT_PATCH) return 'patch'
  if (kind === ExtendedKind.GIT_PULL_REQUEST) return 'pull-request'
  if (kind === ExtendedKind.GIT_PULL_REQUEST_UPDATE) return 'pull-request-update'
  if (kind === ExtendedKind.GIT_ISSUE) return 'issue'
  if (kind === ExtendedKind.GIT_GRASP_LIST) return 'grasp-list'
  return STATUS_TYPES[kind]
}

export function getNip34EventMetadata(event: Event): Nip34EventMetadata | undefined {
  const type = getEventType(event.kind)
  if (!type) return undefined

  const repository = getRepositoryCoordinate(event)
  const repositoryId = repository?.id
  const patchCommit = event.tags.findLast(
    (tag) => tag[0] === 'r' && !!tag[1] && tag[2] !== 'euc'
  )?.[1]
  const commit = getFirstTagValue(event, 'commit') ?? getFirstTagValue(event, 'c') ?? patchCommit
  let title = ''

  switch (type) {
    case 'repository':
      title = getFirstTagValue(event, 'name') ?? repositoryId ?? ''
      break
    case 'repository-state':
      title = repositoryId ?? ''
      break
    case 'patch':
      title = getPatchSubject(event) ?? commit ?? ''
      break
    case 'pull-request':
    case 'issue':
      title =
        getFirstTagValue(event, 'subject') ??
        getFirstContentLine(event.content) ??
        repositoryId ??
        ''
      break
    case 'pull-request-update':
      title = commit ?? repositoryId ?? ''
      break
    case 'grasp-list':
      title = getTagValues(event, 'g')[0] ?? ''
      break
    default:
      title = getFirstContentLine(event.content) ?? getFirstTagValue(event, 'merge-commit') ?? ''
  }

  return {
    type,
    title,
    repositoryId,
    repositoryPubkey: repository?.pubkey,
    repositoryRelay: repository?.relay,
    description: getFirstTagValue(event, 'description'),
    labels:
      type === 'repository' || type === 'pull-request' || type === 'issue'
        ? getTagValues(event, 't')
        : [],
    webUrls: getTagValues(event, 'web'),
    cloneUrls: getTagValues(event, 'clone'),
    relayUrls: getTagValues(event, 'relays'),
    graspUrls: getTagValues(event, 'g'),
    maintainers: getTagValues(event, 'maintainers'),
    refs: event.tags
      .filter((tag) => tag[0]?.startsWith('refs/') && tag[1])
      .map(([name, value]) => ({ name, commit: value })),
    head: getFirstTagValue(event, 'HEAD'),
    commit,
    mergeCommit: getFirstTagValue(event, 'merge-commit'),
    appliedCommits: getTagValues(event, 'applied-as-commits'),
    branchName: getFirstTagValue(event, 'branch-name'),
    targetEventId:
      getFirstTagValue(event, 'E') ??
      event.tags.find((tag) => tag[0] === 'e' && tag[3] === 'root')?.[1]
  }
}

function getGitWorkshopRelaySegment(relay?: string): string | undefined {
  if (!relay) return undefined
  const normalized = relay.replace(/\/+$/, '')
  if (normalized.startsWith('wss://')) return encodeURIComponent(normalized.slice(6))
  if (normalized.startsWith('ws://')) return encodeURIComponent(`ws:${normalized.slice(5)}`)
  return undefined
}

function encodeGitWorkshopRepositoryId(repositoryId: string): string {
  return encodeURIComponent(repositoryId).replace(/%25([0-9A-F]{2})/gi, '%2525$1')
}

function getGitWorkshopRepositoryUrlFromMetadata(metadata: Nip34EventMetadata): string | undefined {
  if (!metadata.repositoryId || !metadata.repositoryPubkey) return undefined

  try {
    const identity = nip19.npubEncode(metadata.repositoryPubkey)
    const relay = getGitWorkshopRelaySegment(metadata.repositoryRelay)
    const repositoryId = encodeGitWorkshopRepositoryId(metadata.repositoryId)
    return `https://gitworkshop.dev/${identity}${relay ? `/${relay}` : ''}/${repositoryId}`
  } catch {
    return undefined
  }
}

export function getGitWorkshopRepositoryUrl(event: Event): string | undefined {
  const metadata = getNip34EventMetadata(event)
  return metadata ? getGitWorkshopRepositoryUrlFromMetadata(metadata) : undefined
}

export function getGitWorkshopUrl(event: Event, eventPointer: string): string | undefined {
  const metadata = getNip34EventMetadata(event)
  if (!metadata) return undefined

  const eventUrl = `https://gitworkshop.dev/${eventPointer}`
  const repositoryUrl = getGitWorkshopRepositoryUrlFromMetadata(metadata)
  if (!repositoryUrl) return eventUrl

  if (metadata.type === 'repository' || metadata.type === 'repository-state') return repositoryUrl
  if (metadata.type === 'issue') return `${repositoryUrl}/issues/${eventPointer}`
  if (metadata.type === 'pull-request') return `${repositoryUrl}/prs/${eventPointer}`
  if (metadata.type === 'patch') {
    const isSubPatch = event.tags.some((tag) => tag[0] === 'e' && tag[1])
    return isSubPatch ? eventUrl : `${repositoryUrl}/prs/${eventPointer}`
  }

  return eventUrl
}
