import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Use the project's existing vector wordmark without altering its paths.
const logo = await readFile(new URL('../logo-light.svg', import.meta.url), 'utf8')
const paths = logo.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)?.[1]
if (!paths) throw new Error('Could not read the Jumble wordmark')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:serif="http://www.serif.com/" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="#fafafa"/>
  <g transform="translate(160 128) scale(0.327)" fill="#171717"
    style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2">
    ${paths}
  </g>
  <text x="512" y="365" text-anchor="middle" font-family="Arial, sans-serif"
    font-size="25" fill="#525252">Explore Nostr through relay feeds</text>
</svg>
`

// Resolve the renderer separately so generating artwork doesn't add app dependencies.
const rendererPath = process.argv[2]
if (!rendererPath) throw new Error('Pass the path to an installed @resvg/resvg-js module')
const { Resvg } = await import(rendererPath)
await writeFile(
  new URL('../../fastlane/metadata/android/en-US/images/featureGraphic.png', import.meta.url),
  new Resvg(svg).render().asPng()
)
console.log(
  fileURLToPath(
    new URL('../../fastlane/metadata/android/en-US/images/featureGraphic.png', import.meta.url)
  )
)
