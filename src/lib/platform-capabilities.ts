import { isAndroid } from './platform'

/** Android intentionally does not offer DMs, regardless of saved user preferences. */
export const supportsDirectMessages = (): boolean => !isAndroid()
