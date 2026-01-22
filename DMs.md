# DMs Implementation Plan: NIP-4e + NIP-17

## Overview

Add Direct Messages functionality to Jumble using NIP-4e (key isolation) and NIP-17 (private gift-wrapped messages). This ensures user private keys and encryption private keys are fully isolated.

## Key Features

- **NIP-4e Key Isolation**: Separate encryption key from identity key
- **NIP-17 Private DMs**: 3-layer encryption (rumor → seal → gift wrap)
- **Full NIP-4e Support**: Encryption key announcement (10044) + multi-device key transfer (4454/4455)
- **No Legacy NIP-04**: Only modern NIP-17 protocol

## Architecture

### Key Management (3 Keypairs)

1. **Identity Key** `(a, A)`: Main Nostr identity (for signing events, may be in bunker)
2. **Encryption Key** `(e, E)`: Dedicated key for NIP-44 encryption/decryption (isolated, shared across devices)
3. **Client Key** `(t, T)`: Per-device key for receiving encryption key transfers (never leaves device)

### Protocol Flow

**Sending a DM:**

1. Create unsigned rumor (kind 14/15) with message content
2. Seal the rumor (kind 13) encrypted with sender's encryption key
3. Gift wrap the seal (kind 1059) encrypted for recipient's encryption key
4. Publish to recipient's DM relays

**Receiving a DM:**

1. Fetch gift wraps (kind 1059) addressed to us
2. Unwrap using encryption key (3-layer decryption)
3. Extract and display rumor

**Multi-Device Setup (NIP-4e):**

The correct flow for setting up a new device:

1. **Check DM Relays (kind 10050)**:

   - Query if user has configured DM relays
   - If no DM relays: Prompt user to configure DM relays first (required for NIP-17)
   - DM relays are specified in kind 10050 event with `"relay"` tags

2. **Query Existing Encryption Key (kind 10044)**:

   - Check if user already has a kind 10044 event from other devices
   - If kind 10044 exists: Proceed to step 3 (import existing encryption key)
   - If no kind 10044: Generate new encryption key `(e, E)` and publish kind 10044

3. **New Device Key Transfer**:

   - New device generates client keypair `(t, T)` (never leaves device)
   - New device publishes kind 4454 with client key `T` and client name
   - First device detects kind 4454 and prepares key transfer

4. **Key Transfer via kind 4455**:

   - First device generates one-time keypair `(c, C)` for this transfer
   - First device encrypts encryption key `e` to client key `T` using NIP-44
   - First device publishes kind 4455 with encrypted key
   - New device decrypts and stores encryption key `e`
   - Both devices delete kinds 4454 and 4455 after successful transfer

## Implementation Steps

### Step 1: Core Infrastructure

#### 1.1 Type Extensions

**File**: `src/types/index.d.ts`

- Add NIP-44 encryption utility methods to `ISigner` interface:
  ```typescript
  // NIP-44 encryption algorithm (general-purpose, key passed as parameter)
  nip44Encrypt?: (privkey: Uint8Array, pubkey: string, plainText: string) => Promise<string>
  nip44Decrypt?: (privkey: Uint8Array, pubkey: string, cipherText: string) => Promise<string>
  ```

**Note**: These are generic NIP-44 encryption utilities. The caller decides which key to use:

- For NIP-4e DMs: Use the isolated encryption key
- For other NIP-44 use cases: Use identity key or other key as needed
- Add DM-related types:

  ```typescript
  type TDmConversation = {
    key: string // pubkey of other participant
    pubkey: string
    lastMessageAt: number
    lastMessageContent: string
    unreadCount: number
  }

  type TDmMessage = {
    id: string
    conversationKey: string
    senderPubkey: string
    content: string // Decrypted content (for performance, avoid repeated decryption)
    createdAt: number
    originalEvent: Event // Original encrypted gift wrap event
    decryptedRumor: Event // Decrypted rumor (kind 14/15)
  }
  ```

#### 1.2 Constants

**File**: `src/constants.ts`

Add to `ExtendedKind`:

```typescript
// NIP-4e
ENCRYPTION_KEY_ANNOUNCEMENT: 10044,
CLIENT_KEY_ANNOUNCEMENT: 4454,
KEY_TRANSFER: 4455,
DM_RELAYS: 10050,

// NIP-17
GIFT_WRAP: 1059,
SEAL: 13,
RUMOR_CHAT: 14,
RUMOR_FILE: 15,
```

Add to `StorageKey`:

```typescript
ENCRYPTION_KEY_PRIVKEY: 'encryptionKeyPrivkey',
CLIENT_KEY_PRIVKEY: 'clientKeyPrivkey',
LAST_READ_DM_TIME_MAP: 'lastReadDmTimeMap',
```

Add default DM relays:

```typescript
export const DEFAULT_DM_RELAYS = [
  'wss://relay.nos.social/',
  'wss://brb.io/',
  'wss://purplepag.es/',
  'wss://relay.damus.io/',
  'wss://nostr.milou.lol/'
]
```

#### 1.3 Encryption Key Service

**File**: `src/services/encryption-key.service.ts`

Core responsibilities:

- **Check DM relays first**: Verify user has configured DM relays (kind 10050) before setup
- Generate and manage encryption keypair `(e, E)`
- Generate and manage client keypair `(t, T)`
- Query existing kind 10044 from relays (check if encryption key already exists)
- Publish kind 10044 (encryption key announcement) to DM relays
- Monitor for kind 4454 from self (new device requesting key)
- Publish kind 4455 (encrypted key transfer)
- Import encryption key from kind 4455

**IMPORTANT: DM Relay Setup Flow**

Before any encryption key operations, the service must:

1. Check if user has kind 10050 (DM relays event)
2. If no DM relays: Return error or prompt user to configure DM relays
3. Use DM relays for all kind 10044, 4454, 4455 operations

Key methods:

```typescript
class EncryptionKeyService {
  // Check if DM relays are configured
  hasDmRelays(): Promise<boolean>
  getDmRelays(): Promise<string[]>

  // Encryption key management
  getEncryptionKeypair(): { privkey: Uint8Array; pubkey: string }
  hasEncryptionKey(): boolean

  // Query existing encryption key from relays
  queryEncryptionKeyAnnouncement(): Promise<Event | null>

  // Publish or update encryption key announcement
  publishEncryptionKeyAnnouncement(): Promise<Event>

  // Client key for multi-device transfer
  getClientKeypair(): { privkey: Uint8Array; pubkey: string }

  // Export encryption key for transfer (kind 4455)
  exportKeyForTransfer(recipientPubkey: string): Promise<string>

  // Import encryption key from transfer (kind 4455)
  importKeyFromTransfer(event: Event): Promise<boolean>

  // Publish client key announcement (kind 4454) for new device
  publishClientKeyAnnouncement(clientName: string): Promise<Event>

  // Monitor for kind 4455 (key transfer response)
  monitorKeyTransfer(): Observable<Event>

  // Setup flow: ensures DM relays + encryption key
  initializeEncryption(): Promise<{
    isNewKey: boolean
    dmRelays: string[]
    existingKeyFound: boolean // true if kind 10044 already exists
  }>
}
```

**New Device Setup Flow** (when existing kind 10044 is detected):

1. New device detects existing kind 10044 from other devices
2. Publish kind 4454 with client key `(t, T)` and device name
3. Show UI prompt: "请前往其他设备确认密钥同步"
4. Monitor for kind 4455 response
5. Import encryption key when kind 4455 received
6. Delete kinds 4454 and 4455 after successful transfer

````

#### 1.4 NIP-17 Gift Wrap Service

**File**: `src/services/nip17-gift-wrap.service.ts`

Use nostr-tools `nip59` module for gift wrapping operations.

**Important**: This service uses the generic NIP-44 encryption from signer, with the caller providing the key (NIP-4e isolated key for DMs).

Key methods:
```typescript
class Nip17GiftWrapService {
  // Create 3-layer encrypted gift wrap
  createGiftWrap(
    rumor: EventTemplate,  // kind 14/15
    senderPrivkey: Uint8Array,  // NIP-4e isolated key (not identity key!)
    recipientPubkey: string,
    relays?: string[]
  ): Promise<Event>  // kind 1059

  // Unwrap gift wrap and extract rumor (decrypts 3 layers)
  unwrapGiftWrap(
    giftWrap: Event,  // kind 1059
    myPrivkey: Uint8Array  // NIP-4e isolated key
  ): Promise<Event | null>  // returns decrypted rumor

  // Create rumor (inner message)
  createRumor(
    content: string,
    recipientPubkey: string,
    extraTags?: string[][]
  ): EventTemplate  // kind 14
}
````

**Encryption Flow** (3 layers):

1. **Rumor** (kind 14): Unsigned message content
2. **Seal** (kind 13): NIP-44 encrypted with sender's isolated key
3. **Gift Wrap** (kind 1059): NIP-44 encrypted with random one-time key for recipient

#### 1.5 DM Relay Service

**File**: `src/services/dm-relay.service.ts`

Manage DM relays (kind 10050).

Key methods:

```typescript
class DmRelayService {
  getDmRelays(pubkey: string): Promise<string[]>
  publishDmRelays(relays: string[]): Promise<Event>
  getDefaultDmRelays(): string[]
}
```

### Step 2: Provider & Signer Extensions

#### 2.1 Extend Signers

**Files**:

- `src/providers/NostrProvider/nsec.signer.ts`
- `src/providers/NostrProvider/bunker.signer.ts`
- `src/providers/NostrProvider/nip-07.signer.ts`

Add NIP-44 encryption utility methods to each signer.

**Design**: Generic NIP-44 encryption with key as parameter. Caller decides which key to use.

```typescript
import { nip44 } from 'nostr-tools'

// Generic NIP-44 encryption (caller provides the key)
async nip44Encrypt(privkey: Uint8Array, pubkey: string, plainText: string) {
  if (!privkey) {
    throw new Error('Private key required for NIP-44 encryption')
  }
  return nip44.encrypt(privkey, pubkey, plainText)
}

async nip44Decrypt(privkey: Uint8Array, pubkey: string, cipherText: string) {
  if (!privkey) {
    throw new Error('Private key required for NIP-44 decryption')
  }
  return nip44.decrypt(privkey, pubkey, cipherText)
}
```

**Usage Examples**:

```typescript
// For NIP-4e DMs: Use isolated encryption key
const isolatedKey = encryptionKeyService.getEncryptionKeypair()
signer.nip44Encrypt(isolatedKey.privkey, recipientPubkey, plaintext)

// For other NIP-44 use cases: Use identity key
signer.nip44Encrypt(identityKey, recipientPubkey, plaintext)
```

#### 2.2 Extend NostrProvider Context

**File**: `src/providers/NostrProvider/index.tsx`

Add to `TNostrContext`:

```typescript
// NIP-44 encryption utilities (generic, caller provides key)
nip44Encrypt: (privkey: Uint8Array, pubkey: string, plainText: string) => Promise<string>
nip44Decrypt: (privkey: Uint8Array, pubkey: string, cipherText: string) => Promise<string>

// NIP-4e: Encryption key management (isolated key for DMs)
ensureEncryptionKey: () => Promise<void>
hasEncryptionKey: () => boolean
getIsolatedEncryptionKey: () => {
  privkey: Uint8Array
  pubkey: string
}
```

Implement methods that delegate to current signer. For NIP-4e DM encryption, the UI layer will:

1. Get isolated encryption key via `getIsolatedEncryptionKey()`
2. Pass it to `nip44Encrypt/Decrypt` methods

### Step 3: Storage Layer

#### 3.1 Extend IndexedDB

**File**: `src/services/indexed-db.service.ts`

Add object stores:

```typescript
DM_CONVERSATIONS: 'dmConversations',
DM_MESSAGES: 'dmMessages',
ENCRYPTION_KEY_ANNOUNCEMENTS: 'encryptionKeyAnnouncements'
```

Add methods:

```typescript
// Conversations
putDmConversation(conversation: TDmConversation): Promise<void>
getDmConversation(pubkey: string): Promise<TDmConversation | null>
getAllDmConversations(): Promise<TDmConversation[]>

// Messages (store decrypted content for performance)
putDmMessage(message: TDmMessage): Promise<void>
getDmMessages(conversationKey: string, limit?: number): Promise<TDmMessage[]>
getLatestDmMessage(conversationKey: string): Promise<TDmMessage | null>

// Encryption key announcements
putEncryptionKeyAnnouncement(event: Event): Promise<void>
getEncryptionKeyAnnouncement(pubkey: string): Promise<Event | null>
```

**Important**: `TDmMessage` stores both:

- `originalEvent`: The encrypted gift wrap (kind 1059) for reference
- `decryptedRumor`: The decrypted rumor (kind 14/15) with actual content
- `content`: The decrypted content string (extracted from rumor for quick access)

This avoids repeated decryption when loading messages from IndexedDB.

#### 3.2 Extend LocalStorage

**File**: `src/services/local-storage.service.ts`

Add methods for key storage:

```typescript
getEncryptionKeyPrivkey(): string | null
setEncryptionKeyPrivkey(privkey: string): void
getClientKeyPrivkey(): string | null
setClientKeyPrivkey(privkey: string): void
getLastReadDmTime(pubkey: string): number
setLastReadDmTime(pubkey: string, time: number): void
```

### Step 4: UI Components

#### 4.0 DM Relay Configuration (Setup Requirement)

**File**: `src/components/DmRelayConfig/index.tsx`

**IMPORTANT**: This component MUST be shown before DM functionality can be used. It checks for and configures DM relays (kind 10050).

**Features**:

- Check if user has DM relays configured (kind 10050)
- Display list of current DM relays
- Add/remove DM relays
- Use default DM relays as suggestions
- Publish updated kind 10050 event

**When to Show**:

- First time accessing DMs
- When encryption key service detects no DM relays
- Accessible from DM page settings

**Structure**:

```typescript
export default function DmRelayConfig({ onComplete }: { onComplete: () => void }) {
  const { publish, pubkey } = useNostr()
  const [relays, setRelays] = useState<string[]>(DEFAULT_DM_RELAYS)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    // Publish kind 10050 with relay tags
    const event = {
      kind: ExtendedKind.DM_RELAYS,
      tags: relays.map(url => ['relay', url]),
      content: ''
    }
    await publish(event)
    onComplete()
  }

  return (
    <div className="p-4">
      <h2>Configure DM Relays</h2>
      <p>Direct messages require special relays. Please configure at least one DM relay.</p>
      <RelaySelector value={relays} onChange={setRelays} />
      <Button onClick={handleSave} disabled={relays.length === 0}>
        Save and Continue
      </Button>
    </div>
  )
}
```

#### 4.0.1 New Device Key Sync (Multi-Device Setup)

**File**: `src/components/NewDeviceKeySync/index.tsx`

**IMPORTANT**: This component is shown when a new device detects an existing encryption key (kind 10044) from other devices.

**Features**:

- Detect existing kind 10044 from other devices
- Automatically publish kind 4454 with client key
- Show prompt: "请前往其他设备确认密钥同步" (Please go to another device to confirm key sync)
- Monitor for kind 4455 response
- Show progress/spinner while waiting
- Auto-dismiss and navigate to DM list when sync completes

**When to Show**:

- New device setup with existing kind 10044 detected
- After `initializeEncryption()` returns `existingKeyFound: true`

**Structure**:

```typescript
export default function NewDeviceKeySync({ onComplete }: { onComplete: () => void }) {
  const { pubkey } = useNostr()
  const [status, setStatus] = useState<'requesting' | 'waiting' | 'success' | 'error'>('requesting')
  const [deviceName] = useState(() => {
    // Generate device name (e.g., "Jumble on iPhone", "Jumble on Web")
    return `Jumble on ${platform} ${browser ? browser.name : ''}`
  })

  useEffect(() => {
    const initiateSync = async () => {
      // Publish kind 4454 with client key
      await encryptionKeyService.publishClientKeyAnnouncement(deviceName)
      setStatus('waiting')

      // Monitor for kind 4455
      const subscription = encryptionKeyService.monitorKeyTransfer().subscribe({
        next: async (keyTransferEvent) => {
          // Import encryption key from kind 4455
          const success = await encryptionKeyService.importKeyFromTransfer(keyTransferEvent)
          if (success) {
            setStatus('success')
            setTimeout(() => onComplete(), 1500)
          }
        },
        error: () => setStatus('error')
      })

      return () => subscription.unsubscribe()
    }

    initiateSync()
  }, [deviceName, onComplete])

  if (status === 'requesting') {
    return <LoadingSpinner text="Initializing key sync..." />
  }

  if (status === 'waiting') {
    return (
      <div className="p-4 flex flex-col items-center gap-4">
        <div className="text-center">
          <h2>设置密钥同步</h2>
          <p>请前往您的其他设备确认密钥同步请求</p>
          <p className="text-sm text-muted-foreground">
            请在其他打开 Jumble 的设备上确认此请求
          </p>
        </div>
        <LoadingSpinner text="等待其他设备确认..." />
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="p-4 flex flex-col items-center gap-4">
        <CheckCircle className="text-green-500" />
        <div className="text-center">
          <h2>密钥同步成功！</h2>
          <p>您现在可以开始使用私信功能了</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>同步失败</AlertTitle>
          <AlertDescription>
            密钥同步失败，请重试。确保其他设备在线并已登录 Jumble。
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>重试</Button>
      </div>
    )
  }
}
```

#### 4.1 Primary Page - DM List

**File**: `src/pages/primary/DmPage/index.tsx`

Display list of conversations with latest message preview.

**IMPORTANT**: This page must handle the full setup flow in the correct order.

**Setup Flow**:

1. Check DM relays (kind 10050) - show DmRelayConfig if missing
2. Initialize encryption (check for existing kind 10044)
3. If existing key found - show NewDeviceKeySync component
4. Otherwise - create new key and show DM list

Features:

- DM relay configuration check
- Encryption key initialization
- New device key sync (if needed)
- Contact avatar and name
- Last message content (truncated)
- Timestamp
- Unread count badge
- Click to open conversation (secondary page)

Structure:

```typescript
const DmPage = forwardRef<TPageRef>((_, ref) => {
  const { pubkey } = useNostr()
  const [setupState, setSetupState] = useState<'loading' | 'need_relays' | 'need_sync' | 'ready'>('loading')

  useEffect(() => {
    const initialize = async () => {
      // Step 1: Check if DM relays are configured
      const hasRelays = await encryptionKeyService.hasDmRelays()
      if (!hasRelays) {
        setSetupState('need_relays')
        return
      }

      // Step 2: Initialize encryption (checks for existing kind 10044)
      const result = await encryptionKeyService.initializeEncryption()

      // Step 3: If existing key found, need to sync from other device
      if (result.existingKeyFound) {
        setSetupState('need_sync')
        return
      }

      // Step 4: All set, show DM list
      setSetupState('ready')
    }

    initialize()
  }, [])

  if (setupState === 'loading') {
    return (
      <PrimaryPageLayout ref={ref} pageName="dms" titlebar={<DmPageTitlebar />}>
        <LoadingSpinner />
      </PrimaryPageLayout>
    )
  }

  if (setupState === 'need_relays') {
    return (
      <PrimaryPageLayout ref={ref} pageName="dms" titlebar={<DmPageTitlebar />}>
        <DmRelayConfig onComplete={() => {
          // After configuring relays, re-run initialization
          setSetupState('loading')
        }} />
      </PrimaryPageLayout>
    )
  }

  if (setupState === 'need_sync') {
    return (
      <PrimaryPageLayout ref={ref} pageName="dms" titlebar={<DmPageTitlebar />}>
        <NewDeviceKeySync onComplete={() => setSetupState('ready')} />
      </PrimaryPageLayout>
    )
  }

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="dms"
      titlebar={<DmPageTitlebar />}
      displayScrollToTopButton
    >
      <DmList />
    </PrimaryPageLayout>
  )
})
```

#### 4.2 DM List Component

**File**: `src/components/DmList/index.tsx`

Fetch and display conversations from IndexedDB.

Subscribe to:

- Gift wraps (kind 1059) for real-time updates
- Encryption key announcements (kind 10044) to know who supports DMs

#### 4.3 Secondary Page - DM Conversation

**File**: `src/pages/secondary/DmConversationPage/index.tsx`

Chat view for a single conversation.

Features:

- Message list with bubbles (sent vs received)
- Auto-scroll to latest message
- Message input with send button
- Real-time message updates

Route: `/dms/:pubkey` (accepts both hex and npub)

Structure:

```typescript
const DmConversationPage = forwardRef(({ pubkey }: { pubkey?: string }, ref) => {
  const { nip44Encrypt, getIsolatedEncryptionKey, publish } = useNostr()
  const [messages, setMessages] = useState<TDmMessage[]>([])

  const sendMessage = async (content: string) => {
    // Get NIP-4e isolated encryption key (not identity key!)
    const isolatedKey = getIsolatedEncryptionKey()

    // Create rumor (kind 14)
    const rumor = nip17Service.createRumor(content, pubkey)

    // Create gift wrap (kind 1059) using isolated encryption key
    const giftWrap = await nip17Service.createGiftWrap(
      rumor,
      isolatedKey.privkey,  // Use isolated key, not identity key!
      pubkey
    )

    // Publish to recipient's DM relays
    const dmRelays = await dmRelayService.getDmRelays(pubkey)
    await publish(giftWrap, { specifiedRelayUrls: dmRelays })
  }

  return (
    <SecondaryPageLayout ref={ref} title={<ConversationHeader pubkey={pubkey} />}>
      <DmMessageList messages={messages} />
      <DmInput onSend={sendMessage} />
    </SecondaryPageLayout>
  )
})
```

#### 4.4 DM Message List Component

**File**: `src/components/DmMessageList/index.tsx`

Display messages in chat interface.

Features:

- Infinite scroll (load older messages)
- Different styling for sent vs received
- Timestamps
- Auto-scroll to latest

#### 4.5 DM Input Component

**File**: `src/components/DmInput/index.tsx`

Message composer with encryption.

Features:

- Multi-line textarea
- Character limit
- Send button (Ctrl/Cmd + Enter to send)
- Disable if recipient doesn't support NIP-17

### Step 5: Routing

#### 5.1 Add Primary Route

**File**: `src/routes/primary.tsx`

```typescript
import DmPage from '@/pages/primary/DmPage'

const PRIMARY_ROUTE_CONFIGS = [
  // ... existing routes
  { key: 'dms', component: DmPage }
]
```

#### 5.2 Add Secondary Route

**File**: `src/routes/secondary.tsx`

```typescript
import DmConversationPage from '@/pages/secondary/DmConversationPage'

const SECONDARY_ROUTE_CONFIGS = [
  // ... existing routes
  { path: '/dms/:pubkey', element: <DmConversationPage /> }
]
```

#### 5.3 Add Link Helpers

**File**: `src/lib/link.ts`

```typescript
export const toDms = () => '/dms'
export const toDmConversation = (pubkey: string) => {
  const npub = nip19.npubEncode(pubkey)
  return `/dms/${npub}`
}
```

#### 5.4 Profile Page Integration

**File**: `src/pages/secondary/UserProfilePage/index.tsx` (or existing profile page)

**IMPORTANT**: Add a "Start Chat" button to the user profile page.

**When to Show the Button**:
The button should only be displayed when BOTH conditions are met:

1. User has DM relays configured (has kind 10050)
2. User has encryption key announced (has kind 10044)

**Implementation**:

```typescript
// In UserProfilePage component
const UserProfilePage = forwardRef(({ pubkey }: { pubkey?: string }, ref) => {
  const [canStartDm, setCanStartDm] = useState(false)

  useEffect(() => {
    // Check if this user supports NIP-17 DMs
    const checkDmSupport = async () => {
      if (!pubkey) return

      // Fetch kind 10050 (DM relays)
      const dmRelaysEvent = await clientService.getReplaceableEvent(pubkey, 10050)
      if (!dmRelaysEvent) {
        setCanStartDm(false)
        return
      }

      // Fetch kind 10044 (encryption key announcement)
      const encryptionKeyEvent = await clientService.getReplaceableEvent(pubkey, 10044)
      setCanStartDm(!!encryptionKeyEvent)
    }

    checkDmSupport()
  }, [pubkey])

  const handleStartChat = () => {
    if (!pubkey) return
    const { push } = useSecondaryPage()
    push(toDmConversation(pubkey))
  }

  return (
    <SecondaryPageLayout ref={ref} title={...}>
      {/* ... existing profile content ... */}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* ... existing buttons like Follow, Zap, etc. ... */}

        {canStartDm && (
          <Button onClick={handleStartChat}>
            <MessageCircle />
            {t('Start Chat')}
          </Button>
        )}
      </div>
    </SecondaryPageLayout>
  )
})
```

**UX Notes**:

- Check happens asynchronously, button may appear with slight delay
- Cache results in IndexedDB for faster subsequent loads
- If user doesn't support DMs, don't show the button (no "not supported" message needed)

### Step 6: Event Subscriptions

#### 6.1 Subscribe to DMs

Use `NoteList` pattern or create custom subscription for:

1. **Gift Wraps (kind 1059)**:

   - Filter by `#p` tag = our pubkey
   - Subscribe from our DM relays and recipient's DM relays

2. **Encryption Key Announcements (kind 10044)**:

   - Track which users support NIP-17
   - Cache in IndexedDB

3. **Key Transfer Events (kinds 4454, 4455)**:

   - Monitor for our own events
   - Handle multi-device key transfer

### Step 7: Implementation Order

1. **Week 1: Foundation**

   - Create `EncryptionKeyService` (key generation, storage)
   - Add NIP-44 methods to signers
   - Extend `NostrProvider` context
   - Add types and constants

2. **Week 2: Protocol Implementation**

   - Create `Nip17GiftWrapService` (using nostr-tools)
   - Create `DmRelayService`
   - Add IndexedDB storage for DMs
   - Test encryption/decryption

3. **Week 3: UI Components**

   - Build `DmRelayConfig` (DM relay setup)
   - Build `NewDeviceKeySync` (multi-device sync UI)
   - Build `DmPage` (conversation list with setup flow)
   - Build `DmConversationPage` (chat view)
   - Build `DmList` and `DmMessageList` components
   - Build `DmInput` component
   - Add "Start Chat" button to profile page

4. **Week 4: Integration & Polish**

   - Wire up message sending with NIP-17
   - Implement real-time subscriptions
   - Add routing and navigation
   - Add translations
   - Test multi-device scenario

### Step 8: Critical Files Summary

**Must Create:**

- `src/services/encryption-key.service.ts`
- `src/services/nip17-gift-wrap.service.ts`
- `src/services/dm-relay.service.ts`
- `src/components/DmRelayConfig/index.tsx` - DM relay configuration (shown before DMs can be used)
- `src/components/NewDeviceKeySync/index.tsx` - Multi-device key sync UI (shown when existing kind 10044 detected)
- `src/pages/primary/DmPage/index.tsx`
- `src/pages/secondary/DmConversationPage/index.tsx`
- `src/components/DmList/index.tsx`
- `src/components/DmMessageList/index.tsx`
- `src/components/DmInput/index.tsx`

**Must Modify:**

- `src/types/index.d.ts` - Add ISigner NIP-44 methods and DM types (with decrypted content)
- `src/constants.ts` - Add event kinds and storage keys
- `src/providers/NostrProvider/index.tsx` - Add NIP-44 utilities + NIP-4e key management
- `src/providers/NostrProvider/nsec.signer.ts` - Implement generic NIP-44 methods
- `src/providers/NostrProvider/bunker.signer.ts` - Implement generic NIP-44 methods
- `src/providers/NostrProvider/nip-07.signer.ts` - Implement generic NIP-44 methods (if supported)
- `src/services/indexed-db.service.ts` - Add DM storage (store decrypted content)
- `src/services/local-storage.service.ts` - Add key storage
- `src/routes/primary.tsx` - Add DM route
- `src/routes/secondary.tsx` - Add conversation route
- `src/lib/link.ts` - Add DM navigation helpers
- `src/pages/secondary/UserProfilePage/index.tsx` - Add "Start Chat" button (check for DM support)

### Step 9: Verification

**Testing Checklist:**

1. **DM Relay Configuration (Prerequisite)**

   - [ ] DmRelayConfig component shows when no DM relays configured
   - [ ] Can add/remove DM relays
   - [ ] Kind 10050 published successfully with relay tags
   - [ ] DM relays are saved and persist
   - [ ] Default DM relays are suggested
   - [ ] Cannot proceed without DM relays

2. **Encryption Key Setup**

   - [ ] Check for DM relays happens first
   - [ ] Query for existing kind 10044 before creating new key
   - [ ] Encryption key generated on first DM (if no existing 10044)
   - [ ] Kind 10044 published successfully to DM relays
   - [ ] Encryption key stored locally

3. **Sending Messages**

   - [ ] Create rumor (kind 14)
   - [ ] Create seal (kind 13) with encryption key
   - [ ] Create gift wrap (kind 1059) with random key
   - [ ] Publish to recipient's DM relays
   - [ ] Message appears in local conversation

4. **Receiving Messages**

   - [ ] Subscribe to gift wraps (kind 1059)
   - [ ] Decrypt gift wrap (3-layer)
   - [ ] Extract and display rumor
   - [ ] Update conversation list

5. **Multi-Device (NIP-4e)**

   - [ ] New device publishes kind 4454 when existing kind 10044 detected
   - [ ] New device shows "请前往其他设备确认密钥同步" prompt
   - [ ] Old device detects kind 4454 and publishes kind 4455
   - [ ] New device receives kind 4455 and imports encryption key
   - [ ] Both devices can decrypt same messages
   - [ ] Kinds 4454 and 4455 are deleted after successful transfer

6. **Bunker Compatibility**

   - [ ] Works when identity key is in bunker
   - [ ] Encryption key is local (not in bunker)
   - [ ] Can send/receive DMs without identity key

7. **UI/UX**

   - [ ] Conversation list displays correctly
   - [ ] Chat view shows messages in order
   - [ ] Auto-scroll to latest message
   - [ ] Unread count updates
   - [ ] Navigation between list and chat works

8. **Profile Page "Start Chat" Button**

   - [ ] Button only shows when user has kind 10050 (DM relays)
   - [ ] Button only shows when user has kind 10044 (encryption key)
   - [ ] Button is hidden if either condition is not met
   - [ ] Clicking button navigates to DM conversation page
   - [ ] DM support status is cached for performance

**Manual Test Scenarios:**

1. First-time setup: Configure DM relays before encryption key creation
2. First-time setup: Verify existing kind 10044 is queried before creating new key
3. New device setup: Detect existing kind 10044, show sync prompt
4. New device setup: Publish kind 4454, receive kind 4455, import key
5. Old device setup: Detect kind 4454, publish kind 4455 with encrypted key
6. Send DM to another user (both have encryption keys)
7. Receive DM from another user
8. Test with bunker signer (identity key remote)
9. Test message persistence across reloads (decrypted content loads from IndexedDB)
10. Test unread counts
11. Test sending to user without encryption key (show error)
12. Profile page: Verify "Start Chat" button shows for users with DM support
13. Profile page: Verify "Start Chat" button is hidden for users without DM support

### Step 10: Internationalization

Add to all locale files (`src/i18n/locales/*.ts`):

```typescript
// Navigation
'Messages': 'Messages',
'Start a conversation': 'Start a conversation',

// DM Relay Configuration
'Configure DM Relays': 'Configure DM Relays',
'Direct messages require special relays': 'Direct messages require special relays. Please configure at least one DM relay.',
'DM relays': 'DM relays',
'Add relay': 'Add relay',
'Remove relay': 'Remove relay',
'Save and continue': 'Save and continue',
'Default DM relays': 'Default DM relays',
'At least one DM relay is required': 'At least one DM relay is required',

// New Device Key Sync
'Set up key sync': '设置密钥同步',
'Please go to another device to confirm key sync': '请前往您的其他设备确认密钥同步',
'Please confirm this request on another device with Jumble open': '请在其他打开 Jumble 的设备上确认此请求',
'Waiting for other device to confirm...': '等待其他设备确认...',
'Initializing key sync...': 'Initializing key sync...',
'Key sync successful!': '密钥同步成功！',
'You can now use private messages': '您现在可以开始使用私信功能了',
'Sync failed': '同步失败',
'Key sync failed. Please try again. Make sure other devices are online and logged into Jumble.': '密钥同步失败，请重试。确保其他设备在线并已登录 Jumble。',
'Retry': '重试',

// DM List
'No messages yet': 'No messages yet',
'New message': 'New message',

// Profile Page
'Start Chat': 'Start Chat',

// Conversation
'Type a message': 'Type a message',
'Send': 'Send',
'Encryption key required': 'Encryption key required',
'Setting up encryption...': 'Setting up encryption...',
'You': 'You',

// Errors
'Failed to send message': 'Failed to send message',
'Failed to decrypt message': 'Failed to decrypt message',
'Recipient does not support private messages': 'Recipient does not support private messages',
'Failed to configure DM relays': 'Failed to configure DM relays',
```

## Security Considerations

1. **Key Isolation**: Encryption key is NEVER used for signing events
2. **Key Storage**: Encryption key stored in LocalStorage (acceptable for non-critical key)
3. **Bunker Safety**: When identity key is in bunker, local encryption key allows DM functionality
4. **Metadata Protection**: NIP-17 hides sender/recipient from relays
5. **Forward Secrecy**: Not provided by NIP-17 (can add disappearing messages later)

## Optional Future Enhancements

- Message reactions (sealed DMs)
- File sharing via Blossom (kind 15 rumors)
- Message deletion
- Read receipts
- Search within conversations
- Export conversation history
- Disappearing messages (expiration tags)
