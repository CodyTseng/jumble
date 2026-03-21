# DM (Direct Messages) Feature

## Overview

End-to-end encrypted messaging built on NIP-17 (Gift Wrap) protocol. Uses a dedicated encryption keypair separate from the Nostr identity key.

## Event Kinds

| Kind | Constant | Purpose |
|------|----------|---------|
| 7 | - | Emoji reaction to a DM message |
| 13 | - | Seal (NIP-17 intermediate encryption layer) |
| 14 | `ExtendedKind.RUMOR_CHAT` | Text message |
| 15 | `ExtendedKind.RUMOR_FILE` | Encrypted file attachment |
| 1059 | `ExtendedKind.GIFT_WRAP` | NIP-17 outer wrapper |
| 10044 | `ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT` | Publish encryption public key |
| 10050 | `ExtendedKind.DM_RELAYS` | DM relay list |
| 4454 | `ExtendedKind.CLIENT_KEY_ANNOUNCEMENT` | Device sync announcement |
| 4455 | `ExtendedKind.KEY_TRANSFER` | Encrypted key transfer between devices |

## Architecture

### Encryption Layers

```
Rumor (Kind 14/15) — plaintext message
  └─ Seal (Kind 13) — encrypted with NIP-44 to recipient's encryption pubkey
      └─ Gift Wrap (Kind 1059) — encrypted with random key, random timestamp (NIP-59)
```

- **Message content**: NIP-44 v2 (ECDH)
- **File content**: AES-256-GCM (Web Crypto API)
- **Gift wrap timestamps**: Randomized up to 2 days in the past (NIP-59)

### Dual Key System

- **Encryption Key** (`Kind 10044`): Dedicated keypair for DMs, public key published in `n` tag
- **Client Key** (`Kind 4454`): Per-device keypair for multi-device key sync
- **Account Key**: Nostr identity key, never used for DM encryption

### Relay Strategy

- DM relays (`Kind 10050`) are separate from regular relays
- Messages published to both recipient's and sender's DM relays
- Default relays: `nip17.com`, `relay.damus.io`, `nos.lol`, `relay.primal.net`

### Storage

- **IndexedDB**: Messages and conversations (`dmMessages`, `dmConversations` stores)
- **LocalStorage**: Sync timestamps, read state, encryption key, deleted conversations

## File Structure

### Services

| File | Purpose |
|------|---------|
| `src/services/dm.service.ts` | Core DM logic: send/receive messages, conversation management, sync |
| `src/services/encryption-key.service.ts` | Encryption keypair lifecycle, key publishing, multi-device sync |
| `src/services/nip17-gift-wrap.service.ts` | NIP-17 gift wrap/unwrap, seal creation |
| `src/services/crypto-file.service.ts` | AES-256-GCM file encryption/decryption |

### Components

| File | Purpose |
|------|---------|
| `src/components/DmList/index.tsx` | Conversation list with messages/requests tabs, trust filtering |
| `src/components/DmMessageList/index.tsx` | Message thread display, reactions, replies, file handling |
| `src/components/DmInput/index.tsx` | Rich text input with file upload, mentions, emoji autocomplete |
| `src/components/DmRelayConfig/index.tsx` | DM relay configuration UI |
| `src/components/NewDeviceKeySync/index.tsx` | Multi-device encryption key sync flow |
| `src/components/ResetEncryptionKeyButton/index.tsx` | Reset encryption key with confirmation |

### Pages

| File | Purpose |
|------|---------|
| `src/pages/primary/DmPage/index.tsx` | Primary page with setup wizard (login → relays → encryption key → sync → ready) |
| `src/pages/secondary/DmConversationPage/index.tsx` | Individual conversation thread |

### Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useDmUnread.ts` | Unread count across conversations (respects mute/trust filters) |
| `src/hooks/useDmSupport.ts` | Check if a user supports DM (has relays + encryption key) |

### Routes

- Primary: key `'dms'` → `DmPage`
- Secondary: path `'/dms/:pubkey'` → `DmConversationPage`
- Link helper: `toDmConversation(pubkey)` in `src/lib/link.ts`

## Key Flows

### Setup Flow (DmPage)

```
loading → need_login → need_relays → need_encryption_key → need_sync → ready
```

1. Check if user is logged in
2. Configure DM relays (Kind 10050)
3. Generate and publish encryption key (Kind 10044)
4. Sync key from another device (if needed) or generate new

### Sending a Message

1. User types in `DmInput`, hits send
2. Content serialized (mentions → `nostr:npub`, custom emoji → `:shortcode:`)
3. `dmService.sendMessage()` creates Kind 14 rumor
4. Rumor wrapped in seal (Kind 13) + gift wrap (Kind 1059)
5. Gift wrap published to recipient's + sender's DM relays
6. Optimistic UI shows message immediately (status: `sending` → `sent` / `failed`)

### Sending a File

1. File metadata extracted (dimensions, thumbhash for images)
2. File encrypted with AES-256-GCM → `{ encryptedBlob, key, nonce, originalHash }`
3. Encrypted blob uploaded to media service
4. Kind 15 rumor created with file URL and encryption metadata in tags
5. Wrapped and sent like a regular message

### Receiving Messages

1. Subscribe to gift wraps (Kind 1059) on user's DM relays
2. Unwrap: gift wrap → seal → rumor
3. Extract sender pubkey and encryption pubkey from seal
4. Store in IndexedDB, update conversation metadata
5. Forward sync (since last login) + backward pagination (older messages)

### Multi-Device Key Sync

1. New device publishes `Kind 4454` (client key announcement)
2. Subscribes to `Kind 4455` (key transfer) events
3. Existing device detects the announcement
4. User approves → encryption privkey encrypted with NIP-44 to new device's client pubkey
5. Published as `Kind 4455`, new device decrypts and imports key

### Reactions

- Kind 7 wrapped in gift wrap (same as messages)
- Tagged with `e` tag referencing the message ID
- Rendered as grouped emoji chips below message bubbles
- Long-press on chip to toggle own reaction

## Types

```typescript
type TDmConversation = {
  key: string                  // sorted([pubkey1, pubkey2]).join(':')
  pubkey: string               // Other user's pubkey
  lastMessageAt: number
  lastMessageContent: string   // "[Image]", "[Video]", etc. for files
  unreadCount: number
  hasReplied: boolean
  encryptionPubkey?: string   // Learned from received messages
}

type TDmMessage = {
  id: string                  // Rumor ID
  conversationKey: string
  senderPubkey: string
  content: string             // Text or file URL
  createdAt: number
  originalEvent: Event        // Gift wrap (Kind 1059)
  decryptedRumor: Event       // Unwrapped rumor (Kind 14/15)
  replyTo?: {
    id: string
    content: string
    senderPubkey: string
    tags?: string[][]
  }
}

type TEncryptionKeypair = {
  privkey: Uint8Array
  pubkey: string              // Hex
}
```
