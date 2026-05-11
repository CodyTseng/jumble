import { toast } from 'sonner'

export type TZapStatusResult = { preimage: string; invoice: string } | null

export type TZapStatusMessages = {
  loading: string
  success: string
  canceled: string
  error: (error: unknown) => string
}

export function trackZapStatus<T extends TZapStatusResult>(
  promise: Promise<T>,
  messages: TZapStatusMessages
): Promise<T> {
  const { unwrap } = toast.promise(promise, {
    loading: messages.loading,
    success: (result) => (result ? messages.success : messages.canceled),
    error: messages.error,
    duration: 10_000
  })

  return unwrap()
}
