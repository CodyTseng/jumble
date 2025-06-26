import { useState } from 'react'

export function Favicon({ domain, className }: { domain: string; className?: string }) {
  const [error, setError] = useState(false)
  if (error) return null

  return (
    <img
      src={`https://${domain}/favicon.ico`}
      alt={domain}
      className={className}
      onError={() => setError(true)}
    />
  )
}
