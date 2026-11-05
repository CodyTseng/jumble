import { mkdir, readFile, writeFile } from 'node:fs/promises'

const rendererPath = process.argv[2]
if (!rendererPath) throw new Error('Pass the path to an installed @resvg/resvg-js module')
const { Resvg } = await import(rendererPath)
const output = new URL(
  '../../fastlane/metadata/android/en-US/images/phoneScreenshots/',
  import.meta.url
)
await mkdir(output, { recursive: true })
const scenes = [
  [
    '01-relay-feed',
    '#eee8f7',
    '#7960ac',
    'Browse Nostr',
    'by relay.',
    'Choose a relay and explore its feed.'
  ],
  [
    '02-note-replies',
    '#e7f0e9',
    '#4b7a65',
    'Follow the',
    'conversation.',
    'Read notes and explore threaded replies.'
  ],
  [
    '03-notifications',
    '#f8ece0',
    '#a16a40',
    'See your',
    'notifications.',
    'Keep up with replies, reactions, reposts and zaps.'
  ],
  [
    '04-profile',
    '#e8eef7',
    '#526d98',
    'Explore Nostr',
    'profiles.',
    'Read their notes, follow them and stay connected.'
  ]
]
for (const [name, background, accent, title, second, subtitle] of scenes) {
  const png = await readFile(new URL(`raw/${name}.png`, import.meta.url))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs><clipPath id="screen"><rect x="108" y="340" width="864" height="1536" rx="26"/></clipPath></defs>
  <rect width="1080" height="1920" fill="${background}"/>
  <circle cx="1060" cy="152" r="190" fill="${accent}" opacity=".06"/>
  <g font-family="Arial, sans-serif" fill="#202024">
    <text x="76" y="80" font-size="32" font-weight="700" letter-spacing="-1">jumble</text>
    <text x="1004" y="78" font-size="20" text-anchor="end" fill="${accent}">NOSTR CLIENT</text>
    <text x="76" y="167" font-size="64" font-weight="700" letter-spacing="-2">${title}</text>
    <text x="76" y="239" font-size="64" font-weight="700" letter-spacing="-2">${second}</text>
    <text x="79" y="291" font-size="27" fill="#53525b">${subtitle}</text>
  </g>
  <rect x="100" y="332" width="880" height="1552" rx="34" fill="${accent}" opacity=".18"/>
  <image x="108" y="340" width="864" height="1536" clip-path="url(#screen)" xlink:href="data:image/png;base64,${png.toString('base64')}"/>
</svg>`
  await writeFile(new URL(`${name}.png`, output), new Resvg(svg).render().asPng())
  console.log(new URL(`${name}.png`, output).pathname)
}
