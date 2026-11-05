import { sha256 } from '@noble/hashes/sha2.js'
import { bech32 } from '@scure/base'
import { finalizeEvent, getPublicKey, nip19, type Event, type EventTemplate } from 'nostr-tools'
import { bytesToHex } from 'nostr-tools/utils'

export const RELAY_URL = 'wss://relay.jumble.social/'
const sceneTime =
  typeof window === 'undefined'
    ? null
    : (new URLSearchParams(window.location.search).get('at') ??
      (window.location.pathname === '/' && !new URLSearchParams(window.location.search).has('demo')
        ? null
        : sessionStorage.getItem('screenshotEpoch')))
export const now =
  sceneTime && /^\d{10}$/.test(sceneTime) ? Number(sceneTime) : Math.floor(Date.now() / 1000)
if (typeof window !== 'undefined') sessionStorage.setItem('screenshotEpoch', String(now))
function localAsset(url: string) {
  return typeof window === 'undefined' ? url : url.replace(window.location.origin, '')
}
const banner = localAsset(new URL('./banner.svg?no-inline', import.meta.url).href)
const people = [
  [
    'mira',
    'Mira Park',
    'Sketchbook in my bag, curiosity in my pocket.\nDrawing little moments and taking the scenic route. 🌿'
  ],
  ['theo', 'Theo Fox', 'Coffee, quiet trails, and good conversations. ☕'],
  [
    'nia',
    'Nia Brooks',
    'Growing a tiny balcony jungle. Plants, slow mornings, and community gardens. 🌱'
  ],
  ['luca', 'Luca', 'A little robot with a big curiosity. Building useful things in the open.'],
  ['aya', 'Aya', 'Rainy-day reader. Collector of stories, postcards, and very good noodles.'],
  ['ren', 'Ren Ito', 'Making music, baking bread, and finding the small joys. 🎵']
] as const
const avatars = {
  mira: new URL('./avatars/mira.png', import.meta.url).href,
  theo: new URL('./avatars/theo.png', import.meta.url).href,
  nia: new URL('./avatars/nia.png', import.meta.url).href,
  luca: new URL('./avatars/luca.png', import.meta.url).href,
  aya: new URL('./avatars/aya.png', import.meta.url).href,
  ren: new URL('./avatars/ren.png', import.meta.url).href
}
type PersonId = (typeof people)[number][0]

// Public, deterministic test keys. The screenshot transport refuses every publish.
export const users = Object.fromEntries(
  people.map(([id, name, about], i) => {
    const secret = new Uint8Array(32)
    secret[31] = i + 1
    const pubkey = getPublicKey(secret)
    return [
      id,
      {
        id,
        name,
        about,
        secret,
        pubkey,
        npub: nip19.npubEncode(pubkey),
        avatar: localAsset(avatars[id])
      }
    ]
  })
) as Record<
  PersonId,
  {
    id: PersonId
    name: string
    about: string
    secret: Uint8Array
    pubkey: string
    npub: string
    avatar: string
  }
>

export const events: Event[] = []
function event(
  author: PersonId,
  kind: number,
  content: string,
  minutesAgo: number,
  tags: string[][] = []
) {
  const template: EventTemplate = {
    kind,
    content,
    created_at: now - Math.round(minutesAgo * 60),
    tags
  }
  const result = finalizeEvent(template, users[author].secret)
  events.push(result)
  return result
}

for (const person of Object.values(users)) {
  event(
    person.id,
    0,
    JSON.stringify({
      name: person.id,
      display_name: person.name,
      about: person.about,
      picture: person.avatar,
      banner,
      lud16: `${person.id}@wallet.jumble.social`
    }),
    0
  )
  event(person.id, 10002, '', 100, [['r', RELAY_URL]])
  event(
    person.id,
    3,
    '',
    90,
    Object.values(users)
      .filter((other) => other.id !== person.id)
      .map((other) => ['p', other.pubkey])
  )
}

export const thread = event(
  'mira',
  1,
  'What is one little ritual that makes your day better?\n\nMine is taking the long way home—with a sketchbook and no plans. 🌿',
  18
)
export const walk = event(
  'theo',
  1,
  'Took the early train, found a quiet trail, and forgot to check my phone for two hours.\n\nA pretty good way to spend a Saturday. ☀️\n\n#slowdays #outdoors',
  4
)
event(
  'nia',
  1,
  'Balcony update: the basil has officially taken over. 🌱\n\nIf you are starting your first little garden, try herbs. They forgive mistakes and make dinner better.',
  9
)
export const drawing = event(
  'mira',
  20,
  'A little color study from my walk. Trying to notice more and scroll a little less.',
  28,
  [['imeta', `url ${banner}`, 'm image/svg+xml', 'dim 1440x480']]
)
event(
  'luca',
  1,
  'Tiny weekend project: a page that helps neighbors swap books. No signup, no algorithm—just a shelf and a little curiosity. 📚\n\nWhat are you making this weekend?',
  35
)
event(
  'aya',
  1,
  'A bookshop, a rainy window, and nowhere else to be.\n\nSome plans are better when they stay small. ☔',
  47
)
event(
  'ren',
  1,
  'The bread is a little crooked. The kitchen smells wonderful. Calling this one a success. 🍞',
  62
)
event(
  'nia',
  1,
  'A neighbor left a little pot of mint by my door. Returned it with a loaf of bread.\n\nThis is my favorite kind of social network. 💚',
  120
)
event(
  'nia',
  1,
  'Today’s garden lesson: a new leaf is worth celebrating, even when the rest of the week is a bit of a mess. 🌿',
  240
)

export const poll = event('mira', 1068, 'A free afternoon. Where are you heading?', 85, [
  ['polltype', 'singlechoice'],
  ['option', 'park', 'A walk in the park 🌿'],
  ['option', 'cafe', 'A cozy café ☕'],
  ['option', 'books', 'A neighborhood bookshop 📚'],
  ['relay', RELAY_URL],
  ['endsAt', String(now + 86400)]
])

function reply(author: PersonId, content: string, age: number, parent = thread) {
  return event(author, 1, content, age, [
    ['e', thread.id, RELAY_URL, 'root', thread.pubkey],
    ...(parent.id === thread.id ? [] : [['e', parent.id, RELAY_URL, 'reply', parent.pubkey]]),
    ['p', thread.pubkey],
    ...(parent.pubkey === thread.pubkey ? [] : [['p', parent.pubkey]])
  ])
}
const firstReply = reply(
  'nia',
  'Ten minutes with my plants before opening any apps. Nothing urgent has ever happened to a fern. 🌱',
  12
)
reply('theo', 'Making coffee slowly, then drinking it outside. Even five minutes counts. ☕', 14)
reply(
  'mira',
  '“Nothing urgent has ever happened to a fern” deserves a place in my sketchbook. 😂',
  10,
  firstReply
)
reply('ren', 'Playing one song on the piano before work. No practice goals—just a song I love.', 15)
reply('aya', 'A few pages of a book on the train. It makes the whole commute feel different.', 16)
reply('luca', 'Writing down one thing I learned that day. The tiny discoveries add up.', 17)

// A varied, coherent notification timeline for Mira: reply, like, zap, repost,
// mention, quote, highlight and poll response, all linked to actual fixture notes.
reply(
  'theo',
  'Tried the long way home today. Found a tiny bakery I had never noticed. You were right! 🥐',
  0.4
)
event('nia', 7, '💚', 1, [
  ['e', drawing.id],
  ['p', users.mira.pubkey],
  ['k', String(drawing.kind)]
])
event('aya', 6, JSON.stringify(thread), 3, [
  ['e', thread.id, RELAY_URL],
  ['p', users.mira.pubkey]
])
event(
  'luca',
  1,
  `nostr:${users.mira.npub} your color study inspired my weekend project. A little more green, a little less gray. 🌿`,
  5,
  [['p', users.mira.pubkey]]
)
event(
  'ren',
  1,
  `A good reminder to leave room for small adventures.\n\nnostr:${nip19.noteEncode(thread.id)}`,
  7,
  [
    ['q', thread.id, RELAY_URL, users.mira.pubkey],
    ['p', users.mira.pubkey]
  ]
)
event('nia', 9802, 'Trying to notice more and scroll a little less.', 11, [
  ['e', drawing.id, RELAY_URL],
  ['p', users.mira.pubkey],
  ['context', drawing.content]
])
for (const [i, id] of (['theo', 'nia', 'aya', 'ren', 'luca'] as const).entries()) {
  event(id, 1018, '', 13 + i, [
    ['e', poll.id],
    ['p', users.mira.pubkey],
    ['response', ['cafe', 'park', 'books'][i % 3]]
  ])
}

// Syntactically decodable, unpayable demo invoice; no real wallet or payment.
// Its preimage/hash agree so the real UI's receipt checks remain in use.
const preimage = new Uint8Array(32).fill(42)
const paymentHash = sha256(preimage)
const timeWords = Array.from({ length: 7 }, (_, i) => Math.floor(now / 2 ** (5 * (6 - i))) & 31)
const hashWords = bech32.toWords(paymentHash)
const invoice = bech32.encode(
  'lnbc210n',
  [
    ...timeWords,
    1,
    hashWords.length >> 5,
    hashWords.length & 31,
    ...hashWords,
    ...new Array<number>(104).fill(0)
  ],
  2000
)
const zapRequest = event('ren', 9734, 'Keep making lovely things! ✨', 2, [
  ['p', users.mira.pubkey],
  ['e', drawing.id],
  ['amount', '21000'],
  ['relays', RELAY_URL]
])
event('luca', 9735, '', 2, [
  ['p', users.mira.pubkey],
  ['P', users.ren.pubkey],
  ['e', drawing.id],
  ['bolt11', invoice],
  ['description', JSON.stringify(zapRequest)],
  ['preimage', bytesToHex(preimage)]
])

for (const note of [thread, walk, drawing]) {
  for (const [i, id] of (['theo', 'nia', 'aya', 'ren', 'luca'] as const).entries()) {
    event(id, 7, '+', Math.max(0.1, (now - note.created_at) / 60 - 1 - i / 10), [
      ['e', note.id],
      ['p', note.pubkey],
      ['k', String(note.kind)]
    ])
  }
}

export const screenshotLinks = {
  feed: `/?demo=feed&at=${now}`,
  note: `/notes/${nip19.noteEncode(thread.id)}?demo=note&at=${now}`,
  notifications: `/?demo=notifications&page=notifications&at=${now}`,
  profile: `/users/${users.nia.npub}?demo=profile&at=${now}`,
  settings: `/?demo=settings&page=settings&at=${now}`
}
