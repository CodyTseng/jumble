/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
/** Select diagnostic metadata explicitly; do not collect argument, request,
 * environment or credential-store dumps. Dependency messages are scrubbed below. */
export type ErrorContext = {
  operation?: string
  recovery?: string
  tool?: string
  exitCode?: number
  status?: number
  target?: string
  detail?: string
  cause?: unknown
}

export class DiagnosticError extends Error {
  readonly context: ErrorContext
  constructor(
    readonly code: string,
    message: string,
    context: ErrorContext = {}
  ) {
    super(message, { cause: context.cause })
    this.name = 'DiagnosticError'
    this.context = context
  }
}

/** Scrub before truncating, so a cut cannot turn a recognizable key into a leak. */
export function redactDiagnostic(value: string, limit = 2000) {
  return value
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(
      /-----BEGIN[^\n]*PRIVATE KEY-----[\s\S]*?(?:-----END[^\n]*PRIVATE KEY-----|$)/gi,
      '[private key redacted]'
    )
    .replace(/(?:bunker|nostrconnect):[^\s<>"']*/gi, '[signer link redacted]')
    .replace(/https?:\/\/[^\s<>"']+|wss?:\/\/[^\s<>"']+/gi, (value) => {
      try {
        const url = new URL(value)
        const privateParts = !!(url.username || url.password || url.search || url.hash)
        url.username = ''
        url.password = ''
        url.search = ''
        url.hash = ''
        return url.href + (privateParts ? '[credentials/query redacted]' : '')
      } catch {
        return '[invalid URL redacted]'
      }
    })
    .replace(/\b(?:nsec1|ncryptsec1)[a-z0-9_-]+/gi, '[private key redacted]')
    .replace(/\b[a-f0-9]{64}\b/gi, '[64-character key/hash redacted]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[token redacted]')
    .replace(
      /(--?(?:password|passphrase|secret|token|api[_-]?key|private[_-]?key)\s+)(?:"[^"]*"|'[^']*'|\S+)/gi,
      '$1[redacted]'
    )
    .replace(
      /\b((?:authorization|proxy-authorization|cookie|set-cookie|password|passphrase|secret|token|api[_-]?key|private[_-]?key|client[_-]?key)\b["']?\s*[:=]\s*)[^\n]*/gi,
      '$1[redacted]'
    )
    .slice(0, limit)
    .trim()
}

const recovery: Record<string, string> = {
  ENOENT:
    'Check the named file or executable and the project directory (--project). Run soyli doctor to check prerequisites.',
  EACCES:
    'Check ownership and permissions of the named path. Use a directory writable by your user.',
  EPERM: 'Check filesystem or operating-system permissions for this operation.',
  EROFS: 'Choose a writable filesystem.',
  ENOSPC: 'Free disk space before retrying.',
  EADDRINUSE: 'Choose a free port; soyli dev --port 0 selects one automatically.',
  ECONNREFUSED: 'Check that the selected service is running and its host/port are correct.',
  ENOTFOUND: 'Check the service hostname and DNS connection.',
  EAI_AGAIN: 'DNS lookup failed temporarily. Check your connection and retry.',
  ETIMEDOUT:
    'The operation timed out. Check connectivity and the selected service before retrying.',
  INVALID_JSON: 'Fix the JSON syntax in the configuration or input file and retry.',
  INVALID_CONFIG: 'Correct the listed configuration fields and retry.',
  INVALID_BUNKER:
    'Check the link against the stated limit or format. Retry soyli account connect and paste it at the hidden prompt; do not pass the link as a command argument.',
  SESSION_STORAGE:
    'Run soyli account list, select a remote account with account use, then run account storage file or account storage keychain. Local private-key storage is unchanged.',
  SESSION_CLEANUP:
    'The destination session is saved. Retry the account storage command named in the error to remove its old copy; no re-pairing is needed.',
  KEYSTORE_FILE:
    'Check the indicated owner-only permissions and keep credentials outside Git. Do not replace the session or paste its contents into a bug report.',
  USAGE: 'Run soyli --help for the command syntax.'
}

export type Diagnostic = {
  code: string
  message: string
  operation: string
  recovery: string
  details?: string[]
  stage?: string
  retryable?: boolean
}

function errorMessage(error: Error) {
  // JSON/parser errors can quote arbitrary input, including plaintext secrets.
  if (error instanceof SyntaxError)
    return 'Invalid JSON or syntax in the input; source contents omitted.'
  // Only validators that construct messages from field paths/rules may explicitly
  // set diagnosticMessage. Other Zod messages can contain rejected secret values.
  if (error.name === 'ZodError' && 'issues' in error && Array.isArray(error.issues))
    return (
      'Invalid configuration: ' +
      error.issues
        .slice(0, 8)
        .map(
          (issue) =>
            `${Array.isArray(issue.path) ? issue.path.join('.') || '(root)' : '(root)'} (${issue.code}${issue.code === 'custom' && typeof issue.params?.diagnosticMessage === 'string' ? `: ${issue.params.diagnosticMessage}` : ''})`
        )
        .join(', ')
    )
  return error.message || error.name || 'An error was raised without a message.'
}

export function diagnose(error: unknown, operation = 'soyli'): Diagnostic {
  const e =
    error instanceof Error ? error : new Error('A dependency failed without an Error message.')
  const context = e instanceof DiagnosticError ? e.context : {}
  const rawCode = 'code' in e && typeof e.code === 'string' ? e.code : ''
  const code =
    e instanceof SyntaxError
      ? 'INVALID_JSON'
      : e.name === 'ZodError'
        ? 'INVALID_CONFIG'
        : /^[A-Z][A-Z0-9_]{0,63}$/.test(rawCode)
          ? rawCode
          : e.name === 'AbortError'
            ? 'CANCELLED'
            : e.name === 'TimeoutError'
              ? 'ETIMEDOUT'
              : 'CLI_ERROR'
  const details: string[] = []
  const seen = new Set<unknown>([e])
  const add = (text: string) => {
    const safe = redactDiagnostic(text)
    if (safe && details.length < 8 && !details.includes(safe)) details.push(safe)
  }
  const metadata = (context: ErrorContext) => {
    if (context.tool) add(`Tool: ${context.tool}`)
    if (context.exitCode !== undefined) add(`Exit status: ${context.exitCode}`)
    if (context.status !== undefined) add(`HTTP status: ${context.status}`)
    if (context.target) add(`Target: ${context.target}`)
    if (context.detail) add(context.detail)
  }
  metadata(context)
  const cause = (item: unknown, depth: number) => {
    if (!(item instanceof Error) || seen.has(item) || depth > 3 || details.length >= 8) return
    seen.add(item)
    const code = 'code' in item && typeof item.code === 'string' ? ` (${item.code})` : ''
    add(`Cause${code}: ${errorMessage(item)}`)
    if (item instanceof DiagnosticError) metadata(item.context)
    if (item instanceof AggregateError)
      for (const child of item.errors.slice(0, 4)) cause(child, depth + 1)
    cause(item.cause, depth + 1)
  }
  if (e instanceof AggregateError) for (const child of e.errors.slice(0, 4)) cause(child, 0)
  cause(e.cause, 0)
  return {
    code,
    message: redactDiagnostic(errorMessage(e)),
    operation: redactDiagnostic(context.operation ?? operation, 160),
    recovery: redactDiagnostic(
      context.recovery ??
        recovery[code] ??
        ('stage' in e && 'retryable' in e && e.retryable
          ? 'Inspect soyli status and address the cause. Use soyli publish --resume for an existing saved publication.'
          : undefined) ??
        'Address the reported cause. If it persists, run soyli doctor and include this error and the soyli version in your bug report.'
    ),
    ...(details.length ? { details } : {}),
    ...('stage' in e && typeof e.stage === 'string'
      ? { stage: redactDiagnostic(e.stage, 40) }
      : {}),
    ...('retryable' in e && typeof e.retryable === 'boolean' ? { retryable: e.retryable } : {})
  }
}

export function formatDiagnostic(error: Diagnostic) {
  return [
    `${error.code}: ${error.message}`,
    `Operation: ${error.operation}`,
    ...(error.details ?? []),
    `Next: ${error.recovery}`
  ].join('\n')
}

/** Bounded, line-aware output: secrets split across chunks are scrubbed together. */
export class ToolOutput {
  private decoder = new TextDecoder()
  private pending = ''
  private tail = ''
  private dropping = false
  private privateKey = false
  constructor(private emit?: (text: string) => void) {}
  push(bytes: Uint8Array) {
    for (const character of this.decoder.decode(bytes, { stream: true })) {
      if (character === '\n') {
        if (!this.dropping) this.line(this.pending)
        this.pending = ''
        this.dropping = false
      } else if (!this.dropping) {
        this.pending += character
        if (this.pending.length > 8192) {
          this.line('[Tool output line exceeded 8 KiB; omitted]')
          this.pending = ''
          this.dropping = true
        }
      }
    }
  }
  private line(value: string) {
    if (/-----BEGIN[^\n]*PRIVATE KEY-----/i.test(value)) {
      this.privateKey = !/-----END[^\n]*PRIVATE KEY-----/i.test(value)
      value = '[private key redacted]'
    } else if (this.privateKey) {
      if (/-----END[^\n]*PRIVATE KEY-----/i.test(value)) this.privateKey = false
      return
    }
    const text = redactDiagnostic(value, 8192) + '\n'
    this.tail = (this.tail + text).slice(-8192)
    this.emit?.(text)
  }
  finish() {
    this.pending += this.decoder.decode()
    if (this.pending && !this.dropping) this.line(this.pending)
    this.pending = ''
    this.dropping = false
  }
  get text() {
    return this.tail.trim()
  }
}
