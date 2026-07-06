import i18n from '@/i18n'
import { toast } from 'sonner'

// Signers that require manual approval — NIP-46 remote signers (bunker /
// nostr-connect) and NIP-07 browser extensions configured to prompt — forward
// a sign request to the user's signer and wait. Without any feedback the user
// has no idea a signature is pending and may forget to approve it.
//
// We show a deliberately low-key hint: after a short delay (so instant
// auto-approvals stay silent), a small loading toast appears in the corner and
// auto-dismisses once the signature comes back or the hint has been visible
// long enough. Concurrent sign requests are reference-counted into a single
// toast so frequent signing never stacks up.
//
// We also bound the wait with a timeout: if the signer never responds (offline
// bunker, closed extension popup, etc.) the request rejects instead of hanging
// forever. The window is generous so a user manually approving still makes it.

const SHOW_DELAY_MS = 1000
const TOAST_TIMEOUT_MS = 60_000
const TIMEOUT_MS = 30_000
const TOAST_ID = 'signer-approval-waiting'

let pending = 0
let timer: ReturnType<typeof setTimeout> | null = null
let shown = false

function scheduleShow() {
  timer = setTimeout(() => {
    timer = null
    if (pending > 0) {
      shown = true
      toast.loading(i18n.t('Waiting for signer approval...'), {
        id: TOAST_ID,
        duration: TOAST_TIMEOUT_MS,
        onAutoClose: () => {
          shown = false
        },
        onDismiss: () => {
          shown = false
        }
      })
    }
  }, SHOW_DELAY_MS)
}

function hide() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (shown) {
    shown = false
    toast.dismiss(TOAST_ID)
  }
}

export async function withSignerApproval<T>(promise: Promise<T>, timeout = TIMEOUT_MS): Promise<T> {
  if (pending === 0) {
    scheduleShow()
  }
  pending++

  let timeoutTimer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(
      () => reject(new Error(i18n.t('Signer did not respond in time'))),
      timeout
    )
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutTimer)
    pending--
    if (pending === 0) {
      hide()
    }
  }
}
