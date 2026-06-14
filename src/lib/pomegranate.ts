import { POMEGRANATE_OPERATOR_URLS } from '@/constants'
import {
  PomegranatePopupBlockedError,
  PomegranatePopupClosedError
} from '@/services/pomegranate.service'
import storage from '@/services/local-storage.service'
import { TAccount, TAccountPointer } from '@/types'
import type { TFunction } from 'i18next'

/**
 * Normalizes an operator URL to its origin (drops path, trailing slash, etc.),
 * mirroring the service's internal `massageURL`. Throws on invalid input.
 */
export function normalizePomegranateOperatorUrl(input: string): string {
  let url = input.trim()
  if (!url) {
    throw new Error('Empty operator URL')
  }
  if (!url.startsWith('http')) {
    url = 'http' + (url.startsWith('localhost') ? '' : 's') + '://' + url
  }
  return new URL(url).origin
}

/** The recommended operators, normalized to their origins. */
export const DEFAULT_POMEGRANATE_OPERATORS: string[] = POMEGRANATE_OPERATOR_URLS.map((url) =>
  normalizePomegranateOperatorUrl(url)
)

/**
 * The signing threshold a fresh account defaults to for `n` operators: a little
 * over half, so signing tolerates a few operators being offline while no small
 * subset can sign on its own.
 */
export function defaultPomegranateThreshold(n: number): number {
  return Math.ceil((n * 7) / 12)
}

/** A short human label (host) for an operator URL. */
export function pomegranateOperatorLabel(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * A pomegranate account is a bunker (NIP-46) account created via "Login with
 * Google". It is identified by the central server URL stored on the account,
 * rather than by comparing against a constant that may change over time.
 */
export function isPomegranateAccount(account: TAccount): boolean {
  return account.signerType === 'bunker' && !!account.pomegranateCentral
}

/**
 * Like `isPomegranateAccount`, but for an account pointer (pubkey + signerType).
 * Resolves the full account from storage to read its `pomegranateCentral`.
 */
export function isPomegranateAccountByPointer(account: TAccountPointer): boolean {
  const full = storage.findAccount(account)
  return !!full && isPomegranateAccount(full)
}

/**
 * Maps a pomegranate flow error to a user-facing message, or `null` when the
 * user simply closed the popup, in which case no message should be shown.
 */
export function describePomegranateError(err: unknown, t: TFunction): string | null {
  if (err instanceof PomegranatePopupClosedError) {
    return null
  }
  if (err instanceof PomegranatePopupBlockedError) {
    return t('Popup was blocked. Please allow popups for this site and try again.')
  }
  return err instanceof Error ? err.message : t('Something went wrong')
}
