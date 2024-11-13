import { IS_ELECTRON } from '@renderer/lib/env'
import { clsx, type ClassValue } from 'clsx'
import { useParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getParams<P extends Record<string, string | undefined>>(
  props
): Readonly<Partial<P>> {
  if (IS_ELECTRON) {
    return props
  } else {
    return useParams() as Readonly<Partial<P>>
  }
}
