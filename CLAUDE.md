# CLAUDE.md

This document is designed to help AI Agents better understand and modify the Jumble project.

## Project Overview

Jumble is a user-friendly Nostr client for exploring relay feeds.

- **Project Name**: Jumble
- **Main Tech Stack**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + Radix UI
- **State Management**: Jotai
- **Core Protocol**: Nostr (using nostr-tools)

## Technical Architecture

### Core Dependencies

- **Build Tool**: Vite 5.x
- **Frontend Framework**: React 18.3.x + TypeScript
- **Styling Solution**:
  - Tailwind CSS (primary styling framework)
  - Radix UI (unstyled component library)
  - next-themes (theme management)
  - tailwindcss-animate (animations)
- **State Management**: Jotai 2.x
- **Routing**: path-to-regexp (custom routing solution)
- **Rich Text Editor**: TipTap 2.x
- **Nostr Protocol**: nostr-tools 2.x
- **Other Key Libraries**:
  - i18next (internationalization)
  - dayjs (date handling)
  - flexsearch (search)
  - qr-code-styling (QR codes)
  - yet-another-react-lightbox (image viewer)

### Project Structure

```
jumble/
├── src/
│   ├── components/           # React components
│   │   ├── ui/               # Base UI components (shadcn/ui style)
│   │   └── ...               # Other feature components
│   ├── providers/            # React Context Providers
│   ├── services/             # Business logic service layer
│   ├── hooks/                # Custom React Hooks
│   ├── lib/                  # Utility functions and libraries
│   ├── types/                # TypeScript type definitions
│   ├── pages/                # Page components
|   |   ├── primary           # Primary page components (Left column)
│   │   └── secondary         # secondary page components (Right column)
│   ├── layouts/              # Layout components
│   ├── i18n/                 # Internationalization resources
|   |   ├── locales           # Localization files
│   │   └── index.tx          # Basic i18n setup
│   ├── assets/               # Static assets
│   ├── App.tsx               # App root component
│   ├── PageManager.tsx       # Page manager (custom routing logic)
│   ├── routes                # Route configuration
|   |   ├── primary.tsx       # Primary routes (Left column)
│   │   └── secondary.tsx     # Secondary routes (Right column)
│   └── constants.ts          # Constants definition
├── public/                   # Public static assets
└── resources/                # Design resources
```

## Development Guide

### Environment Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Code Conventions

### Component Development

1. **Component Structure**: Each major feature component is typically in its own folder, containing index.tsx and related sub-components
2. **Styling**: Use Tailwind CSS utility classes, complex components can use class-variance-authority (cva)
3. **Type Safety**: All components should have explicit TypeScript type definitions
4. **State Management**:
   - Use Jotai atoms for global state management
   - Use Context Providers for cross-component data

### Service Layer (Services)

Service files located in `src/services/` encapsulate business logic:

- `client.service.ts` - Nostr client core logic for fetching and publishing events
- `indexed-db.service.ts` - IndexedDB data storage
- `local-storage.service.ts` - LocalStorage management
- `media-upload.service.ts` - Media upload service
- `translation.service.ts` - Translation service
- `lightning.service.ts` - Lightning Network integration
- `relay-info.service.ts` - Relay information management
- `blossom.service.ts` - Blossom integration
- `custom-emoji.service.ts` - Custom emoji management
- `libre-translate.service.ts` - LibreTranslate API integration
- `media-manager.service.ts` - Managing media play state
- `modal-manager.service.ts` - Managing modal stack for back navigation (ensures modals close one by one before actual page navigation)
- `note-stats.service.ts` - Note statistics storage and retrieval (likes, zaps, reposts)
- `poll-results.service.ts` - Poll results storage and retrieval
- `post-editor-cache.service.ts` - Caching post editor content to prevent data loss
- `web.push.service.ts` - Web metadata fetching for link previews

### Providers Architecture

The app uses a multi-layered Provider nesting structure (see `App.tsx`):

```
ScreenSizeProvider
  └─ UserPreferencesProvider
      └─ ThemeProvider
          └─ ContentPolicyProvider
              └─ NostrProvider
                  └─ ... (more providers)
```

Pay attention to Provider dependencies when modifying functionality.

And some Providers are placed in `PageManager.tsx` because they need to use the `usePrimaryPage` and `useSecondaryPage` hooks.

### Routing System

- Route configuration in `src/routes/primary.tsx` and `src/routes/secondary.tsx`
- Using `PageManager.tsx` to manage page navigation, rendering, and state. Normally, you don't need to modify this file.
- Primary pages (left column) use key-based navigation
- Secondary pages (right column) use path-based navigation with stack support
- More details in "Adding a New Page" section below

### Internationalization (i18n)

Jumble is a multi-language application. When you add new text content, please ensure to add translations for all supported languages as much as possible.

**IMPORTANT: New translation keys must be appended to the end of each locale file (`src/i18n/locales/*.ts`). Never insert new keys in the middle of the file.**

Do not modify or remove existing keys.

At the trial stage, you can skip translation first. After the feature is completed and confirmed satisfactory, you can add translation content later.

- Translation files located in `src/i18n/locales/`
- Using `react-i18next` for internationalization
- Supported languages: ar, de, en, es, fa, fr, hi, hu, it, ja, ko, pl, pt-BR, pt-PT, ru, th, tr, zh, zh-TW

#### Adding New Language

1. Create a new file in `src/i18n/locales/` with the language code (e.g., `th.ts` for Thai)
2. According to `src/i18n/locales/en.ts`, add translation key-value pairs
3. Update `src/i18n/index.ts` to include the new language resource
4. Update `detectLanguage` function in `src/lib/utils.ts` to support detecting the new language
5. If the new language is RTL (right-to-left, e.g. Arabic, Persian, Hebrew, Urdu), add its base code to the `RTL_LANGUAGES` array in `src/i18n/index.ts`

### RTL (Right-to-Left) Layout Support

Jumble supports RTL languages (currently Arabic `ar` and Persian `fa`). **All new UI must work in both LTR and RTL layouts.** The app sets `<html dir="rtl">` automatically when an RTL language is active (see `applyDocumentDirection` in `src/i18n/index.ts`), and wraps the tree in a Radix `DirectionProvider` in `src/App.tsx` so Radix primitives (ScrollArea, DropdownMenu, Dialog, Popover, Tooltip, Select, etc.) follow suit.

#### Conventions

**Always prefer logical Tailwind classes over physical ones.** Tailwind v4 supports these natively; they flip automatically when `dir="rtl"` is set.

| Use (logical) | Not (physical) |
| --- | --- |
| `ms-*`, `me-*` | `ml-*`, `mr-*` |
| `ps-*`, `pe-*` | `pl-*`, `pr-*` |
| `start-*`, `end-*` | `left-*`, `right-*` |
| `text-start`, `text-end` | `text-left`, `text-right` |
| `border-s`, `border-e` | `border-l`, `border-r` |
| `rounded-s-*`, `rounded-e-*` | `rounded-l-*`, `rounded-r-*` |
| `rounded-ss-*`, `rounded-se-*`, `rounded-es-*`, `rounded-ee-*` | `rounded-tl-*`, `rounded-tr-*`, `rounded-bl-*`, `rounded-br-*` |

**Exceptions — keep physical classes when anchoring to the screen edge, not to content flow.** Modal close buttons (top-right by global convention), notification badges on icon corners, dialog centering via `left-[50%]`, and carousel prev/next buttons anchored to physical positions should stay physical.

#### What does NOT flip automatically

- **CSS transforms** (`translate-x-*`, `rotate-*`): these are not direction-aware. Use the `rtl:` variant to compensate, e.g. `translate-x-full rtl:-translate-x-full`.
- **Direction-sensitive icons** from `lucide-react` (`ChevronRight`, `ChevronLeft`, `ArrowLeft`, `ArrowRight`, `ChevronsLeft`, `ChevronsRight`, etc.) when used as navigation/drill-in/back indicators: add `className="rtl:-scale-x-100"` to flip horizontally. Skip the flip when the icon represents a physical spatial concept (e.g. carousel arrows tied to absolute `left-4`/`right-4` buttons).
- **JS-driven directions** — props like Vaul's `direction="left"`, Embla's scroll direction, or any manually-positioned element using `offsetLeft`/`scrollLeft`. Read `i18n.dir()` via `useTranslation` and branch accordingly. Example: `<Drawer direction={i18n.dir() === 'rtl' ? 'right' : 'left'}>`.

#### User-generated content (notes, bios, usernames, DM text)

**Add `dir="auto"` to the outermost container of any user-written text.** This lets the browser's Unicode Bidirectional Algorithm pick the direction per content — an Arabic note renders RTL, an English note stays LTR, even inside an RTL app chrome. Mixed text within a single node is handled by UBA automatically.

Current containers that already have `dir="auto"`: `Content`, `MarkdownContent` (inherited), `Username` (both variants), `TextWithEmojis`, `ProfileAbout`, `DmMessageList` bubble text, `ContentPreview/Content`, `ParentNotePreview`, `GroupMetadata`, `CommunityDefinition`. Follow the same pattern for any new component that renders freeform user text.

**Do NOT** put `dir="auto"` on translated UI strings (t() output, button labels, timestamps, relay URLs, event IDs) — those follow chrome direction.

#### When adding a new component, verify

1. No new `ml-*/mr-*/pl-*/pr-*/left-*/right-*/text-left/right/border-l/r/rounded-l/r*` unless physically anchored.
2. Any chevron/arrow used for navigation flow carries `rtl:-scale-x-100`.
3. User-generated text containers carry `dir="auto"`.
4. Any JS that reads `offsetLeft` or sets `translate-x-*` has been thought through for RTL.
5. Smoke-test by switching the app to Arabic (Settings → Languages → العربية) and verifying the feature visually mirrors correctly.

## Nostr Protocol Integration

### Core Concepts

- **Events**: Nostr events (notes, profile updates, etc.). All data in Nostr is represented as events. They have different kinds (kinds) to represent different types of data.
- **Relays**: Relay servers, which are WebSocket servers that store and forward Nostr events.
- **NIPs**: Nostr Implementation Proposals

### Supported Event Kinds

I mean kinds that are supported to be displayed in the feed.

- Kind 1: Short Text Note
- Kind 6: Repost
- Kind 20: Picture Note
- Kind 21: Video Note
- Kind 22: Short Video Note
- Kind 1068: Poll
- Kind 1111: Comment
- Kind 1222: Voice Note
- Kind 1244: Voice Comment
- Kind 9802: Highlight
- Kind 30023: Long-Form Article
- Kind 31987: Relay Review
- Kind 34550: Community Definition
- Kind 30311: Live Event
- Kind 39000: Group Metadata
- Kind 30030: Emoji Pack

More details you can find in `src/components/Note/`. If you want to add support for new kinds, you need to create new components under `src/components/Note/` and update `src/components/Note/index.tsx`.

And also you need to update `src/components/ContentPreview/` to support preview rendering for the new kinds. `ContentPreview` is used in various places like parent notes, notifications, highlight sources, etc. It only has one line of text space, so you need to figure out a suitable preview display method for different types of content. Use text only as much as possible.

Please avoid modifying the framework, such as avatars, usernames, timestamps, and action buttons in the `Note` component. Only add content rendering logic for new types.

## Common Components

### src/components/Note

Used to display a Nostr event (note).

Properties:

- `event`: `NoteEvent` - The Nostr event to display
- `hideParentNotePreview`: `boolean` - Whether to hide the parent note preview
- `showFull`: `boolean` - Whether to show the full content of the note. Default is `false`, which shows a truncated version with "Show more" option when content is long.

### src/components/NoteList

Used to display a list of notes with infinite scrolling support.

Properties:

- `subRequests`: `{ urls: string[]; filter: Omit<Filter, 'since' | 'until'> }[]` - Array of Nostr subscription requests to fetch notes
  - `urls`: Relay URLs for the subscription
  - `filter`: Nostr filter for the subscription (without `since`, `until` and `limit`, which are managed internally)
- `showKinds`: `number[]` - Array of event kinds to display
- `filterMutedNotes`: `boolean` - Whether to filter out muted notes
- `hideReplies`: `boolean` - Whether to hide reply notes
- `hideUntrustedNotes`: `boolean` - Whether to hide notes from untrusted authors
- `filterFn`: `(note: NoteEvent) => boolean` - Custom filter function for notes. Return `true` to display the note, `false` to hide it.

### src/components/Tabs

A tab component for switching between different views.

Properties:

- `tabs`: `{ value: string; label: string }[]` - Array of tab definitions. `value` is the unique identifier for the tab, `label` is the display text. `label` will be passed through `t()` for translation.
- `value`: `string` - Currently selected tab value.
- `onChange`: `(value: string) => void` - Callback function when the selected tab changes.
- `threshold`: `number` - Height threshold for hiding the tab bar on scroll down. Default is `800`. It should larger than the height of the area above the tab bar. Normally you don't need to change this value.
- `options`: `React.ReactNode` - Additional options to display on the right side of the tab bar.

## Feature Documentation

- [DM (Direct Messages)](docs/dm-feature.md) - End-to-end encrypted messaging based on NIP-17

## Electron Mode

Jumble ships as both a web app and an Electron desktop app from a single codebase. The Electron build is opt-in via the `ELECTRON=true` environment flag at build/dev time. The web build is the default and remains unchanged.

### Why Electron

The desktop build solves two problems the web build can't:

1. **Chrome's per-origin WebSocket connection cap**. With many subscribed relays the browser stalls or drops connections. In Electron all relay WebSockets run in the **main process** (Node, no cap).
2. **OS-level secret storage**. Private keys, encryption privkeys, and bunker client keys are written to a `safeStorage`-encrypted file in `userData/`, instead of plaintext `localStorage`.

### Build & Run

```bash
npm run electron:dev      # vite dev + auto-launch electron
npm run electron:build    # vite build + electron-builder → release/<version>/
npm run electron:preview  # vite build + electron .  (no packaging)
```

Web scripts (`npm run dev`, `npm run build`) are untouched and never load any electron-only code.

### Project Layout

```
electron/
├── main/
│   ├── index.ts          # main-process entry (BrowserWindow, app lifecycle)
│   ├── relay-manager.ts  # owns SmartPool, pumps relay events to renderer
│   ├── secrets-store.ts  # safeStorage-backed encrypted secrets file
│   ├── proxy-fetch.ts    # generic HTTP proxy (CORS-bypass for renderer)
│   └── ipc.ts            # ipcMain.handle registrations
├── preload/index.ts      # contextBridge → window.electron
├── shared/ipc-types.ts   # IPC channel names + payload types (used by main + renderer)
└── tsconfig.json         # main-process TS config (Node target)
```

Renderer counterparts:

- `src/lib/platform.ts` — `isElectron()`, `getElectronBridge()` helpers.
- `src/lib/electron-pool.ts` — `ElectronPool` proxy that mimics `SmartPool`'s surface but ferries calls over IPC.
- `src/services/local-storage.service.ts` — `hydrate()` async method called from `main.tsx` before React mount.
- `src/services/web.service.ts` — branches to `bridge.proxy.fetch` in Electron mode.

### Architectural Rules

**Single source code**, mode-branched at the seams:

- `src/lib/smart-pool.ts` is shared by web and main process. It accepts an `isAllowInsecure` getter via constructor options — do not import `local-storage.service` from it.
- Any singleton that the renderer touches (e.g. `ClientService`) chooses its backing implementation in its constructor based on `isElectron() && getElectronBridge()`.
- Signing (`ISigner`, NIP-07, nsec, bunker) **stays in the renderer** in Electron mode too. Browser extension support requires `window.nostr`, which only exists in the renderer.
- Keep all renderer-facing storage APIs **synchronous**. The one async hook is `storage.hydrate()`, awaited once in `main.tsx` before mounting React. Do not introduce `async` getters.

### IPC Contract (`electron/shared/ipc-types.ts`)

The bridge exposed at `window.electron` has three namespaces:

- `relay.*` — `ensure / publish / subscribe / closeSub / auth / close / setAllowInsecure`, plus event-stream listeners (`onSubEvent`, `onSubEose`, `onSubClose`, `onAuthRequest`) and `sendAuthResponse`. The renderer streams events back through `ipcRenderer.on`; the main process triggers AUTH signing via a request/response over IPC so the signer stays in the renderer.
- `secrets.*` — `isAvailable / load / save`. Writes are atomic (tmp + rename) and serialized via a Promise chain.
- `proxy.fetch(url, options)` — **generic CORS-bypass HTTP proxy**. Any future renderer code that needs to bypass CORS should call this rather than add a new channel. Returns `{ ok, status, statusText, url, headers, body }`. Default 15s timeout, 5 MB body cap, custom UA. Renderer parses the body itself (no domain logic in main).

When adding a new IPC channel:
1. Add the channel name to `IPC_CHANNELS` in `electron/shared/ipc-types.ts`.
2. Add types to the same file.
3. Register the handler in `electron/main/ipc.ts`.
4. Expose it in `electron/preload/index.ts` via `contextBridge`.
5. Consume it in renderer via `getElectronBridge()`.

### Secrets Storage Model

- Five secret categories: `nsec`, `ncryptsec`, `bunkerClientSecretKey`, `encryptionKeyPrivkey`, `clientKeyPrivkey`.
- Internally always stored in per-pubkey maps on `LocalStorageService`.
- Web mode: maps serialize back inline into the `accounts` JSON / dedicated localStorage keys (current behavior preserved).
- Electron mode: maps persist via `bridge.secrets.save(...)` to `userData/secrets.enc` (encrypted by OS keychain). The `accounts` JSON in localStorage carries no secrets.
- `getAccounts()`, `findAccount()`, `getCurrentAccount()` always re-attach secrets from the maps so callers like `account.bunkerClientSecretKey` keep working transparently.
- If `safeStorage.isEncryptionAvailable()` is false (rare Linux without keyring), secrets are kept in memory only and a warning is logged. They will not silently degrade to plaintext at rest.

### What Lives Where

| Concern | Web mode | Electron mode |
| --- | --- | --- |
| Relay WebSockets | renderer (`SmartPool`) | main (`SmartPool` + `RelayManager`) |
| Signing (`ISigner`) | renderer | renderer (unchanged) |
| Secret storage | localStorage | `safeStorage` file in `userData/` |
| Cross-origin HTTP fetch | direct or `VITE_PROXY_SERVER` | `bridge.proxy.fetch` |
| IndexedDB caches | renderer | renderer (unchanged) |
| PWA / service worker | enabled | disabled (vite-plugin-pwa skipped) |

### When Modifying Electron Behavior

- Don't add Node-only imports to anything under `src/`. Code in `src/` runs in the renderer (sandboxed Chromium); only `electron/main/**` runs in Node.
- Don't add `import` paths in `electron/main/**` that touch `@/services/local-storage.service` or any other browser-API-dependent module. The shared module pattern (`src/lib/smart-pool.ts`) is fine because it has been deliberately stripped of browser deps.
- When extending the proxy: keep the channel generic. Don't add domain-specific channels for one-off CORS needs — extend `proxy.fetch` options if needed.
- Renderer code must remain functional in pure web mode. Always guard Electron paths with `isElectron() && getElectronBridge()`.

## Common Modification Scenarios

### Adding a New Component

1. Create a component folder in `src/components/`
2. Create `index.tsx` and necessary sub-components
3. Write styles using Tailwind CSS
4. If needed, add base UI components in `src/components/ui/`

### Adding a New Page

#### Adding a Primary Page (Left Column)

Primary pages are the main navigation pages that appear in the left column (or full screen on mobile).

1. **Create the page component**:

   ```bash
   # Create a new folder under src/pages/primary/
   mkdir src/pages/primary/YourNewPage
   ```

2. **Implement the component** (`src/pages/primary/YourNewPage/index.tsx`):

   ```tsx
   import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
   import { TPageRef } from '@/types'
   import { forwardRef } from 'react'

   const YourNewPage = forwardRef<TPageRef>((_, ref) => {
     return (
       <PrimaryPageLayout ref={ref} title="Your Page Title" icon={<YourIcon />}>
         {/* Your page content */}
       </PrimaryPageLayout>
     )
   })

   export default YourNewPage
   ```

   **Important**:

   - Primary pages MUST use `forwardRef<TPageRef>`
   - Wrap content with `PrimaryPageLayout`
   - The ref is used by PageManager for navigation control

3. **Register the route** in `src/routes/primary.tsx`:

   ```tsx
   import YourNewPage from '@/pages/primary/YourNewPage'

   const PRIMARY_ROUTE_CONFIGS: RouteConfig[] = [
     // ... existing routes
     { key: 'yourNewPage', component: YourNewPage }
   ]
   ```

4. **Navigate to the page** using the `usePrimaryPage` hook:

   ```tsx
   import { usePrimaryPage } from '@/PageManager'

   const { navigate } = usePrimaryPage()
   navigate('yourNewPage')
   ```

#### Adding a Secondary Page (Right Column)

Secondary pages appear in the right column (or full screen on mobile) and support stack-based navigation.

1. **Create the page component**:

   ```bash
   # Create a new folder under src/pages/secondary/
   mkdir src/pages/secondary/YourNewPage
   ```

2. **Implement the component** (`src/pages/secondary/YourNewPage/index.tsx`):

   ```tsx
   import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
   import { forwardRef } from 'react'

   const YourNewPage = forwardRef(({ index }: { index?: number }, ref) => {
     return (
       <SecondaryPageLayout ref={ref} index={index} title="Your Page Title">
         {/* Your page content */}
       </SecondaryPageLayout>
     )
   })

   export default YourNewPage
   ```

   **Important**:

   - Secondary pages receive an `index` prop for stack navigation
   - Use `SecondaryPageLayout` for consistent styling
   - The ref enables navigation control

3. **Register the route** in `src/routes/secondary.tsx`:

   ```tsx
   import YourNewPage from '@/pages/secondary/YourNewPage'

   const SECONDARY_ROUTE_CONFIGS = [
     // ... existing routes
     { path: '/your-path/:id', element: <YourNewPage /> }
   ]
   ```

   Add the corresponding path generation function in `src/lib/link.ts` for the new route:

   ```tsx
   export const toYourNewPage = (id: string) => `/your-path/${id}`
   ```

4. **Navigate to the page**:

   ```tsx
   import { useSecondaryPage } from '@/PageManager'
   import { toYourNewPage } from '@/lib/link'

   const { push, pop } = useSecondaryPage()

   // Navigate to new page
   push(toYourNewPage('some-id'))

   // Navigate back
   pop()
   ```

5. **Access route parameters**:

   ```tsx
   const YourNewPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
     console.log('Route param id:', id)
     // ...
   })
   ```

#### Key Differences

| Aspect         | Primary Pages                       | Secondary Pages                 |
| -------------- | ----------------------------------- | ------------------------------- |
| **Location**   | Left column (main navigation)       | Right column (detail view)      |
| **Navigation** | Replace-based (`navigate`)          | Stack-based (`push`/`pop`)      |
| **Layout**     | `PrimaryPageLayout`                 | `SecondaryPageLayout`           |
| **Routes**     | Key-based (e.g., 'home', 'explore') | Path-based (e.g., '/notes/:id') |

On mobile devices or single-column layouts, primary pages occupy the full screen, while secondary pages are accessed via stack navigation. When navigating to another primary page, it will clear the secondary page stack.

### How to Parse and Render Content

First, use the `parseContent` method in `src/lib/content-parser.ts` to parse the content. It supports passing different parsers to parse only the needed content for different scenarios. You will get an array of `TEmbeddedNode[]`, and render the content according to the type of these nodes in order. If you need to support new node types, you can add new parsing methods in `src/lib/content-parser.ts`. If you want to recognize specific URLs as special types of nodes, you can extend the `EmbeddedUrlParser` method in `src/lib/content-parser.ts`. A complete usage example can be found in `src/components/Content/index.tsx`.

### Adding New State Management

1. For global state, create a new Provider in `src/providers/`
2. Add Provider in `App.tsx` in the correct dependency order

Or create a singleton service in `src/services/` and use Jotai atoms for state management.

### Adding New Business Logic

1. Create a new service file in `src/services/`
2. Export singleton instance
3. Import and use in anywhere needed

### Style Modifications

- Global styles: `src/index.css`
- Tailwind configuration: `tailwind.config.js`
- Component styles: Use Tailwind class names directly
