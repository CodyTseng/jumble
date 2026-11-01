import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'

// Chrome/Edge and Firefox/Safari both include URL:line:column, but wrap frames
// differently. Replace only that location and keep the rest of the frame intact.
const LOCATION = /(?:https?:\/\/|app:\/\/)[^\s()]+:\d+:\d+/g

export async function resolveErrorStacks(stacks: string[]): Promise<string[]> {
  const maps = new Map<string, Promise<TraceMap | null>>()
  const page = new URL(window.location.href)

  const loadMap = (url: URL) => {
    url.search = ''
    url.hash = ''
    url.pathname += '.map'
    const key = url.href
    let pending = maps.get(key)
    if (!pending) {
      pending = (async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)
        try {
          const response = await fetch(key, { signal: controller.signal })
          if (!response.ok) return null
          return new TraceMap(await response.json())
        } catch {
          return null
        } finally {
          clearTimeout(timer)
        }
      })()
      maps.set(key, pending)
    }
    return pending
  }

  return Promise.all(
    stacks.map(async (stack) => {
      const matches = [...stack.matchAll(LOCATION)]
      const replacements = await Promise.all(
        matches.map(async ([location]) => {
          try {
            const parts = /^(.*):(\d+):(\d+)$/.exec(location)!
            const url = new URL(parts[1])
            // Only fetch this application's generated assets, including Electron's
            // app://renderer origin, rather than extension or third-party frames.
            if (
              url.protocol !== page.protocol ||
              url.host !== page.host ||
              !/\.m?js$/.test(url.pathname)
            ) {
              return location
            }
            const map = await loadMap(url)
            if (!map) return location
            const original = originalPositionFor(map, {
              line: Number(parts[2]),
              column: Math.max(0, Number(parts[3]) - 1)
            })
            if (original.source === null || original.line === null || original.column === null)
              return location
            const name = original.name ? ` [${original.name}]` : ''
            return `${original.source}:${original.line}:${original.column + 1}${name}`
          } catch {
            return location
          }
        })
      )
      let index = 0
      return stack.replace(LOCATION, () => replacements[index++])
    })
  )
}
