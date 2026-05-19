import {
  PomegranatePopupBlockedError,
  PomegranatePopupClosedError
} from '@/services/pomegranate.service'
import { TAccount } from '@/types'
import type { TFunction } from 'i18next'

/**
 * A pomegranate account is a bunker (NIP-46) account created via "Login with
 * Google". It is identified by the central server URL stored on the account,
 * rather than by comparing against a constant that may change over time.
 */
export function isPomegranateAccount(account: TAccount): boolean {
  return account.signerType === 'bunker' && !!account.pomegranateCentral
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
