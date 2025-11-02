# Jumble - Nostr Client Architecture

**Project**: Jumble - A user-friendly Nostr relay feed explorer  
**Type**: React SPA + TypeScript with nostr-tools  
**Key Focus**: Relay-first navigation, multi-account support, flexible feed system  

---

## 1. Core Architecture Pattern

**Framework**: React Context-based state management with composition (NO Redux/Zustand/Jotai)

The app uses a **deep Context Provider stack** as the primary state management mechanism. Each context provider is stacked hierarchically in `App.tsx`, with specialized providers handling:
- Authentication & signing (NostrProvider)
- Feed configuration (FeedProvider)  
- User data (FollowListProvider, MuteListProvider, BookmarksProvider)
- UI state (ThemeProvider, ScreenSizeProvider)
- Nostr protocol specifics (ZapProvider, ReplyProvider, NotificationProvider)

**Key Pattern Insight**: The architecture treats Nostr relays as first-class navigation targets, not just data sources. Users can browse individual relay feeds or follow-based feeds seamlessly through the `FeedProvider` which manages the current feed context.

---

## 2. Directory Structure & Purpose

### `/src/providers` (23 providers)
**Purpose**: React Context providers that manage application state and side effects.

Key providers:
- **NostrProvider**: Central auth/signing system. Manages multiple signer types (nsec, nip-07, bunker, ncryptsec, npub)
- **FeedProvider**: Controls feed type (relay, relays, following) and relay URLs for the current feed
- **FavoriteRelaysProvider**: Manages user's favorite relay sets and NIP-65 relay lists
- **MuteListProvider**: Encrypted mute list management with NIP-59
- **FollowListProvider**: Manages follow relationships (contacts/people list)
- **DeletedEventProvider**: Tracks soft-deleted events (with NIP-09)
- **NotificationProvider**: Manages reply fetching and notification state
- **BookmarksProvider**, **PinListProvider**: User preference lists
- **CurrentRelaysProvider**: Tracks which relays are being actively used in current view
- **ZapProvider**: Lightning zap state and LNURL handling

Each provider typically:
1. Wraps IndexedDB for persistence
2. Fetches replaceable events on login
3. Provides React hooks (e.g., `useNostr()`, `useFeed()`)

### `/src/services` (18+ singleton services)
**Purpose**: Core business logic, Nostr protocol handling, caching, and external integrations.

**Central hub**:
- **client.service.ts** (43KB) - The critical service managing:
  - Relay pool (nostr-tools SimplePool wrapper)
  - Timeline subscriptions with multi-relay deduplication
  - Event caching (replaceables, fetched events, trending)
  - Relay selection for publishing
  - Profile index (FlexSearch for username search)
  - Event stats (reactions, reposts, zaps) via DataLoader

**Data persistence**:
- **indexed-db.service.ts** - IndexedDB wrapper for offline caching of:
  - Profile events (kind 0)
  - Relay lists (kind 10002)
  - Follow lists (kind 3)
  - Mute lists (kind 10001)
  - Bookmarks (kind 10003)
  - Emoji lists, pin lists, relay sets

**Supporting services**:
- **note-stats.service.ts** - Aggregates reactions/reposts/zaps
- **local-storage.service.ts** - Lightweight browser storage for preferences
- **relay-info.service.ts** - NIP-11 relay info caching
- **media-upload.service.ts** - NIP-96 file uploads
- **lightning.service.ts** - LNURL-pay integration for zaps
- **translation.service.ts** - Multi-language note translation
- **custom-emoji.service.ts** - NIP-30 emoji parsing

### `/src/components` (100+ components)
**Organized by feature**:
- `/NoteCard` - Rendering different note types (text, picture, video, unknown, repost)
- `/Note` - Individual note display components
- `/Embedded` - Embedded content (links, images, videos, notes)
- `/Profile` - Profile cards and profile feeds
- `/Sidebar` - Main navigation sidebar
- `/LoginDialog` - Multi-method login UI
- `/PostEditor` - Rich text editor with hashtag/mention autocomplete
- `/RelayInfo` - NIP-11 relay information display
- `/BottomNavigationBar` - Mobile navigation

Key composite component:
- **NormalFeed** - Generic feed component that handles subscription, event collection, deduplication, sorting

### `/src/pages`
**Hierarchy**:
- `/pages/primary` - Tab-level pages (NoteListPage, ExplorePage, ProfilePage, SettingsPage, etc.)
- `/pages/secondary` - Detail pages accessed from primary (NotePage, ProfilePage, RelayPage, SearchPage)

The two-tier system supports:
- Desktop: Sidebar + two-column layout (primary on left, secondary on right)
- Mobile: Single column with bottom nav, secondary overlays primary
- Settings allow single-column layout on desktop

### `/src/lib` (16 utility modules)
- **event.ts** - Event manipulation (replaceable event detection, POW mining)
- **event-metadata.ts** - Parse profile/relay list/mute list events
- **content-parser.ts** - Parse note content for links, mentions, hashtags
- **draft-event.ts** - Create unsigned event drafts (posts, profile updates, list management)
- **pubkey.ts** - Pubkey/npub conversion, formatting
- **tag.ts** - NIP tag parsing helpers
- **url.ts** - Relay URL normalization and validation
- **link.ts** - Generate link hrefs for navigation

### `/src/layouts`
- **PrimaryPageLayout** - Wrapper with titlebar and scroll-to-top button

---

## 3. Nostr-Specific Architecture

### Relay Connection Management
**Strategy**: Use nostr-tools `SimplePool` with intelligent relay selection.

```
ClientService (singleton)
├─ pool: SimplePool (maintains persistent WebSocket connections)
├─ timelines: Map<timelineKey, TTimelineRef[]>
│   (tracks ongoing subscriptions with deduplication across relays)
├─ replaceableEventCacheMap (replaceable events by coordinate)
└─ eventCacheMap + DataLoader (batch event fetching)
```

**Key behaviors**:
- **Pool reuse**: Single pool instance shared across entire app (connection efficiency)
- **Multi-relay subscriptions**: `subscribeTimeline()` accepts multiple `subRequests` (relay URL + filter pairs)
- **Deduplication**: Track seen event IDs across relay boundaries
- **EOSE threshold**: Considers subscription complete when N/2 relays report EOSE (not waiting for slowest relays)

### Event Types Handled
The app tracks extended kinds beyond standard Nostr:

```typescript
ExtendedKind = {
  FAVORITE_RELAYS: 10002,        // NIP-65 (not kind 10002 in code)
  RELAY_SETS: 30000,              // Custom grouping
  RELAY_REVIEW: 30402,            // Custom reviews
  BLOSSOM_SERVER_LIST: 10063      // File hosting
  // + standard kinds 0,1,3,4,5,6,7,9735, etc.
}
```

### Publishing & Relay Selection
When publishing an event:
1. **Check mentions** for `p` tags → fetch their relay lists → include read relays
2. **For replaceable/list events** → add big relays (relay.damus.io, relay.primal.net, etc.)
3. **Author's write relays** (from kind 10002)
4. **Additional relays** specified in publish options
5. **Fallback**: If no relays determined, use BIG_RELAY_URLS

**Publish success**: Event resolves when 1/3 of target relays accept it (optimistic confirmation).

### Event Caching Strategy
- **Replaceable events** (kind 0, 3, 10002, etc.): Store by `(pubkey, kind)` in replaceableEventCacheMap
- **Regular events**: Fetched on-demand, cached in eventCacheMap with DataLoader batching
- **IndexedDB persistence**: User's own events + metadata events of followed users
- **Timeline references**: Track `[relayUrl, createdAt]` pairs to enable "load older" pagination

### Notification System
ReplyProvider tracks:
- Direct replies (events with `e` tag mentioning this note)
- Mentions (events with `p` tag to current user)
- Reactions/zaps (tracked in note-stats.service)
- Fetched from author's write relays on demand

---

## 4. State Management Architecture

### Context Provider Stack (in `App.tsx`)
Execution order (top-level to deepest):
1. **ScreenSizeProvider** - Window size breakpoints (isSmallScreen)
2. **UserPreferencesProvider** - Local storage for UI prefs
3. **ThemeProvider** - Light/dark/pure-black mode
4. **ContentPolicyProvider** - Content filtering rules
5. **DeletedEventProvider** - Soft-deleted event tracking
6. **NostrProvider** - **CORE**: Auth, signing, account switching
7. **ZapProvider** - Lightning integration
8. **TranslationServiceProvider** - Translation backend config
9. **FavoriteRelaysProvider** - User's relay collections
10. **FollowListProvider** - Who the user follows
11. **MuteListProvider** - Muted users/content (encrypted)
12. **UserTrustProvider** - User safety scores
13. **BookmarksProvider** - Bookmarked notes
14. **PinListProvider** - Pinned notes
15. **FeedProvider** - Current feed configuration
16. **ReplyProvider** - Reply tracking
17. **MediaUploadServiceProvider** - File upload config
18. **KindFilterProvider** - Which event kinds to display
19. **PageManager** - Main router logic (below)
20. **Toaster** - Toast notifications

### Data Flow Example: Loading a Note
```
User clicks note link
  → PageManager: push URL to secondary stack
  → SecondaryPageLink opens NotePage
  → NotePage: useFetchEvent(eventId)
    → client.fetchEvent(eventId)
      → Search IndexedDB first
      → If miss, batch request to BIG_RELAY_URLS via DataLoader
    → Check DeletedEventProvider if deleted
    → AddReplies to ReplyProvider for context
  → Display note with reactions (from NoteStatsService)
```

### Multi-Account Switching
**NostrProvider** maintains:
- `accounts`: TAccountPointer[] (pubkey + signerType)
- `account`: Currently active account
- `switchAccount()`: Changes active account, clears state, re-fetches all user lists

Storage:
- Account credentials in localStorage (encrypted nsec optional, bunker URL)
- Account-specific data in IndexedDB (keyed by pubkey)

### Signer Abstraction
Multiple `ISigner` implementations:
- **NsecSigner**: Plain private key (local)
- **Nip07Signer**: Browser extension (nip-07)
- **BunkerSigner**: Remote signing (nip-46)
- **NpubSigner**: Read-only (no signing)
- **NostrConnectionSigner**: Nostr Connect protocol

All implement: `getPublicKey()`, `signEvent()`, `nip04Encrypt()`, `nip04Decrypt()`

---

## 5. Routing Architecture

### Two-Tier Navigation System
**Implemented in PageManager.tsx** (NOT using React Router):

**Primary Pages** (9 tabs shown in sidebar):
- Home (NoteListPage)
- Explore (ExplorePage)
- Notifications (NotificationListPage)
- Profile (MePage)
- Relay (RelayPage - for /relays/:url)
- Search (SearchPage)
- Bookmarks (BookmarkPage)
- Settings (SettingsPage)
- Profile (ProfilePage - user profile when navigating)

**Secondary Pages** (detail views):
- /notes/:id (NotePage)
- /users/:id (ProfilePage)
- /users/:id/following (FollowingListPage)
- /relays/:url/reviews (RelayReviewsPage)
- /settings/* (various settings pages)

### Route Matching
Routes defined in `routes.tsx`:
- Uses `path-to-regexp` matcher for URL pattern matching
- No query params (clean URL design)
- Parameters passed as props to page components

### Navigation State
**For desktop 2-column layout**:
```
Left column: Primary page (sticky)
Right column: Secondary page stack (stack-based history)
```

**For mobile**:
```
Single column showing:
- Primary page (if secondary stack empty)
- Top of secondary stack (if not empty)
- Bottom nav for primary page switching
```

**Stack management**:
- `secondaryStack: TStackItem[]` - Tracks URL history with indices
- Max stack size: 5 (oldest cached components cleared)
- Syncs with browser history (back button support)
- Prevents scrolling primary page when secondary is open

### History Syncing
- Browser history state contains `{ index, url }`
- Custom popstate handler to prevent modal stack conflicts
- Modal manager (modal-manager.service) for dialog history
- URL normalization: Converts nip19 identifiers (npub1, note1) to /users, /notes paths

---

## 6. Feed System Architecture

### Feed Types
```typescript
TFeedType = 'following' | 'relays' | 'relay'
TFeedInfo = { feedType, id?: relayUrl | relaySetId }
```

**Following feed**: Events from followed users (uses follow list from kind 3)
**Relays feed**: Events from a custom relay set (NIP-65 relay groups)
**Relay feed**: Events from single relay (for discovery/browsing)

### FeedProvider Logic
```
On login/feed switch:
1. Determine feed type from storage (default: relay with first favorite relay)
2. Resolve relay URLs:
   - 'relay': Single URL
   - 'relays': Fetch NIP-65 relay set by ID from IndexedDB
   - 'following': Empty array (use follow list instead)
3. Pass URLs to feed consumers (NormalFeed component)
```

### Fetching Pattern (NormalFeed)
```
subscribeTimeline(subRequests=[{urls, filter}])
├─ For each relay URL: subscribe with filter
├─ Deduplicate events by ID across relays
├─ Collect until EOSE from threshold of relays
├─ Sort by created_at descending
├─ Emit onEvents batch callback
└─ Continue emitting onNew for real-time updates
```

Filter defaults to empty (all events) unless configured:
- Can add `kinds: [...]` to filter by event type
- Can add `limit: 100` for initial load size
- Can add `since`/`until` for pagination

### Pagination
`loadMoreTimeline(key, until, limit)`:
- Fetches events with `until < timestamp`
- Maintains timeline reference by hash of URLs + filter
- Batches requests across multiple relay timelines

---

## 7. Key Services Deep Dive

### ClientService
**Responsibilities**:
- Relay pool management
- Event fetching/caching
- Timeline subscriptions
- Publishing events
- Profile searching
- Event stats aggregation

**Notable methods**:
- `subscribeTimeline()` - Multi-relay subscription with deduplication
- `fetchEvent()` - DataLoader-based batch fetching
- `publishEvent()` - Publish to multiple relays with timeout
- `fetchProfile()` - Get latest kind 0 event
- `fetchRelayList()` - Get user's NIP-65 list
- `determinTargetRelays()` - Smart relay selection for publishing
- `initUserIndexFromFollowings()` - Build searchable user profile index

**Caching strategy**:
```
eventCacheMap: Promise<Event | undefined> (with DataLoader)
replaceableEventCacheMap: Map<coordinate, Event>
trendingNotesCache: Event[] | null (fetched once per session)
userIndex: FlexSearch.Index (for username search)
```

### IndexedDB Service
**Schema** (version 9):
- profileEvents, relayListEvents, followListEvents
- muteListEvents, bookmarkListEvents, emojiListEvents
- pinListEvents, favoriteRelays, relaySets
- relayInfos, muteDecryptedTags

**Operations**:
- `getReplaceableEvent(pubkey, kind, d?)` - Get latest replaceable
- `putReplaceableEvent()` - Store/update with deduplication
- `putMuteDecryptedTags()` - Store NIP-59 decrypted tags
- `iterateProfileEvents()` - Iterate for indexing

### LocalStorage Service
Caches user preferences as singletons:
- **Accounts** (with credentials)
- **Current account** pointer
- **Relay sets** (named relay groups)
- **Feed info** per account (which relay/feed to show)
- **UI preferences**: theme, layout, media policy, zap amount
- **Translation/media upload configs**

---

## 8. Unique Architectural Decisions

### No State Management Library
**Why**: Chose Context + React hooks for simplicity. Avoids learning curve, keeps dependencies minimal. Works because:
- State updates are mostly localized to providers
- No complex cross-cutting state mutations
- Natural lazy loading (providers only init on demand)

**Trade-off**: Prop drilling in deep component trees, solved with custom hooks.

### Relay-First UX
Unlike most Nostr clients (feed-first), Jumble:
- Default view: Browse a single relay's latest events (discovery)
- Follow: Switch to following feed (if logged in)
- Search: Cross-relay queries using searchable relays

**Advantage**: Works without login, can explore relays before creating account.

### Soft Deletion (NIP-09)
App doesn't hard-delete, instead:
- Publishes deletion request to relays (kind 5)
- Tracks deleted event IDs in DeletedEventProvider
- UI hides deleted events in feeds
- Original data persists in IndexedDB for recovery

### DataLoader for Event Fetching
**Why used**:
- Batch multiple event ID requests into single subscription
- Deduplicates identical requests within microtask
- LRU caching per instance
- Avoids N subscriptions for N events

### NIP-59 Encrypted Mute Lists
- Mute list events encrypted with NIP-04 (expensive decryption)
- Cached in IndexedDB as plaintext tags
- Only decrypted once per session

### Poll System
- Polls stored as kind 6969 events (custom)
- Results aggregated from reactions (kind 7)
- Supports time-limited polls

---

## 9. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                     │
│  (NoteListPage, NotePage, ProfilePage, etc.)           │
└────────┬───────────────────────────────────┬────────────┘
         │ useFeed()                         │ useNostr()
         ▼                                   ▼
    ┌─────────────────┐         ┌──────────────────────┐
    │   FeedProvider  │         │   NostrProvider      │
    │ feedInfo,       │         │ account, signer,     │
    │ relayUrls       │         │ profile, relayList   │
    └────────┬────────┘         └──────────┬───────────┘
             │                             │
             └─────────┬───────────────────┘
                       │
                       ▼
            ┌──────────────────────────┐
            │  ClientService (singleton)│
            │  + SimplePool            │
            │  + EventCache            │
            │  + Timeline subscriptions│
            └──────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │    Nostr Relays (WebSocket)      │
        │ (relay.damus.io, relays.land...)│
        └──────────────────────────────────┘

Persistence:
┌────────────────┐      ┌──────────────────┐
│  IndexedDB     │      │ LocalStorage     │
│  Events, lists │      │  Preferences     │
│  Relay info    │      │  Accounts        │
└────────────────┘      └──────────────────┘
```

---

## 10. Critical File Locations

**Entry point**: `/src/main.tsx` → `/src/App.tsx` → `PageManager.tsx`

**Core business logic**:
- `/src/services/client.service.ts` - Everything Nostr
- `/src/services/indexed-db.service.ts` - Offline cache
- `/src/providers/NostrProvider/index.tsx` - Auth/signing
- `/src/providers/FeedProvider.tsx` - Feed config

**Key pages to understand**:
- `/src/pages/primary/NoteListPage/index.tsx` - Main feed
- `/src/pages/primary/NoteListPage/RelaysFeed.tsx` - Relay feed implementation
- `/src/pages/primary/NoteListPage/FollowingFeed.tsx` - Follow feed
- `/src/pages/secondary/NotePage.tsx` - Note detail view

**Component patterns**:
- `/src/components/NormalFeed.tsx` - Generic subscription component
- `/src/components/NoteCard/` - Note rendering
- `/src/components/PostEditor/` - Rich text editor

---

## 11. Common Tasks & Where They Live

| Task | Location |
|------|----------|
| Add new event kind | `/src/constants.ts` ExtendedKind, update client.service |
| Create a note | /src/lib/draft-event.ts `createTextNoteDraftEvent()` |
| Publish event | client.service `publishEvent()` via useNostr |
| Fetch user profile | client.service `fetchProfile()`, caches locally |
| Subscribe to feed | NormalFeed component, calls client.subscribeTimeline |
| Decrypt mute list | NostrProvider on login, stores plaintext in IDB |
| Handle relay auth | client.service subscription, calls signer.signEvent |
| Render note content | /src/components/Note/, uses content-parser lib |
| Paginate timeline | client.service `loadMoreTimeline()` |
| Search profiles | client.service userIndex (FlexSearch) |
| Handle zaps | ZapProvider + lightning.service |

---

## 12. Important Gotchas & Design Notes

1. **No React Router**: Custom routing in PageManager. URLs synced with browser history manually.
2. **Singleton services**: ClientService, IndexedDb, LocalStorage are singletons. `getInstance()` pattern.
3. **Provider initialization order matters**: Deeper providers depend on higher ones (NostrProvider needs UserPreferencesProvider).
4. **Replaceable events**: Identified by `(pubkey, kind, d-tag)` coordinate, not event ID.
5. **EOSE threshold**: Waits for N/2 relays, not all (speed over completeness).
6. **Mute list decryption**: Expensive NIP-04, only on login, cached in IndexedDB.
7. **Timeline keys**: Hashed from URLs + filter, stable across renders.
8. **Mobile responsive**: Breakpoint detection in ScreenSizeProvider, dual column hides on small screens.
9. **Auth-required relays**: Auto-retries with signer.signEvent() if relay demands NIP-42 auth.
10. **Event deletion**: NIP-09 soft deletion, no hard DB deletes, UI respects deletion requests.

