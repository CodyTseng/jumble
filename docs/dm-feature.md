# DM (Direct Messages) Feature

## Overview

End-to-end encrypted 1:1 messaging built on top of NIP-17 (Private Direct Messages) / NIP-59 (Gift Wrap) / NIP-44 v2 (encryption). DMs use a **dedicated encryption keypair** separate from the user's Nostr identity key, so the identity signer (NIP-07 extension, nsec, Amber, etc.) never has to decrypt DMs on its own — the decryption key lives in the app and can be synced across devices via a lightweight "Client Key / Key Transfer" protocol.

The code in this feature is largely self-contained inside `src/services/dm.service.ts`, `src/services/encryption-key.service.ts`, `src/services/nip17-gift-wrap.service.ts`, and `src/services/crypto-file.service.ts`. Building an independent DM app should mostly mean lifting these four services plus the IndexedDB schema described below.

## Relevant NIPs

- **NIP-17**: Private Direct Messages (kinds 14 chat rumor, 15 file rumor)
- **NIP-44**: Versioned Encryption (v2, used for seal and gift wrap payloads)
- **NIP-59**: Gift Wrap (kinds 13 seal, 1059 gift wrap, randomized timestamps)
- **NIP-51 / NIP-65 adjacent**: Kind 10050 DM relay list

## Event Kinds

All DM-related kinds are defined in `src/constants.ts` (`ExtendedKind`). Emoji reactions and seal/gift wrap come from `nostr-tools`' `kinds` export.

| Kind  | Constant                             | Source          | Purpose                                                           |
| ----- | ------------------------------------ | --------------- | ----------------------------------------------------------------- |
| 7     | `kinds.Reaction`                     | nostr-tools     | Emoji reaction to a DM message, wrapped the same way as chat     |
| 13    | `kinds.Seal` / `ExtendedKind.SEAL`   | nostr-tools     | NIP-59 seal (encrypted rumor, signed by sender's encryption key)  |
| 14    | `ExtendedKind.RUMOR_CHAT`            | extended        | Plaintext chat rumor (NIP-17 `kinds.PrivateDirectMessage`)        |
| 15    | `ExtendedKind.RUMOR_FILE`            | extended        | Encrypted file attachment rumor                                    |
| 1059  | `kinds.GiftWrap` / `GIFT_WRAP`       | nostr-tools     | NIP-59 outer gift wrap (random-key signed)                        |
| 4454  | `ExtendedKind.CLIENT_KEY_ANNOUNCEMENT` | extended      | Per-device client keypair announcement (for multi-device sync)    |
| 4455  | `ExtendedKind.KEY_TRANSFER`          | extended        | Encrypted encryption-privkey transfer between devices             |
| 10044 | `ExtendedKind.ENCRYPTION_KEY_ANNOUNCEMENT` | extended  | Publishes the user's DM encryption public key (`n` tag)           |
| 10050 | `ExtendedKind.DM_RELAYS`             | extended        | User's DM relay list (NIP-17)                                     |

## Architecture

### Encryption layers (send)

```
Rumor (kind 14 chat / 15 file / 7 reaction, unsigned) — plaintext
  └─ Seal (kind 13, signed by sender's encryption privkey) — NIP-44 v2 to recipient's encryption pubkey
      └─ Gift Wrap (kind 1059, signed by ephemeral random key) — NIP-44 v2 to recipient's encryption pubkey
```

Two layers of NIP-44 encryption with two independent keypairs (the ephemeral random key in the gift wrap and the sender's real encryption key in the seal) is what gives NIP-17 its metadata privacy: a relay can only see "some ephemeral pubkey sent some gift wrap to some encryption pubkey", not who is talking to whom.

The app uses **manual** gift wrap construction (see `src/services/nip17-gift-wrap.service.ts:32`) rather than `nostr-tools`' `createWrap`, because it needs **two `p` tags** on the gift wrap:

- `['p', recipientEncryptionPubkey]` — for NIP-17 subscribers indexing by encryption key
- `['p', recipientMainPubkey]` — so clients subscribing with `#p: [myMainPubkey]` still see their messages

Gift wrap and seal `created_at` are both randomized up to 2 days in the past via `randomTimeUpTo2DaysInThePast()` (`nip17-gift-wrap.service.ts:158`) — this is a NIP-59 requirement to defeat timing-based deanonymization.

### Self-copies

Every send also produces a **self gift wrap** via `createGiftWrapForSelf` (`nip17-gift-wrap.service.ts:64`), addressed to the sender's own encryption pubkey, and published to the sender's own DM relays. This is how the sender's other devices pick up their own outgoing messages during sync.

### Dual Key System

- **Encryption Key** (`Kind 10044`): Long-lived keypair used as the NIP-44 endpoint for DMs. The public key is published in an `n` tag; the private key is stored per-account in `LocalStorage` (`ENCRYPTION_KEY_PRIVKEY_MAP`) and can be re-shared with new devices via Key Transfer.
- **Client Key** (`Kind 4454`): Per-device ephemeral keypair, one per browser/device. Its only purpose is to bootstrap Key Transfer so an old device can encrypt the Encryption privkey for a new device without the user typing a secret. Stored in `CLIENT_KEY_PRIVKEY_MAP`.
- **Account / Identity Key**: The Nostr identity pubkey. **Never** used directly for DM encryption — it only signs the two announcement events (`10044`, `4454`, `10050`) and the `4455` key transfer envelope.

### Relay strategy

- DM relays come from the user's `Kind 10050` list; they are distinct from the regular read/write relays.
- When sending, gift wraps go to **both** the recipient's DM relays *and* the sender's own DM relays (so the sender's other devices can sync).
- Default DM relays (for users who haven't configured any) are defined in `src/constants.ts` — currently `nip17.com`, `relay.damus.io`, `nos.lol`, `relay.primal.net`.

### Storage

- **IndexedDB** (`jumble` DB, schema **v20**): all durable DM state — `dmMessages`, `dmConversations`, `dmRelaysEvents`, `encryptionKeyAnnouncementEvents`. See "IndexedDB schema" below.
- **LocalStorage**: small scalars and keys — encryption privkey, client privkey, sync cursors, last-read timestamps, processed sync-request IDs.

## File structure

### Services

| File                                         | Purpose                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/services/dm.service.ts`                 | Singleton DM core: init/sync, send/receive, conversation CRUD, relay subscription, sending-status state machine   |
| `src/services/encryption-key.service.ts`     | Encryption keypair lifecycle, client key, `Kind 10044` / `4454` / `4455` publishing, Key Transfer import/export   |
| `src/services/nip17-gift-wrap.service.ts`    | Rumor → seal → gift wrap construction and manual unwrap; self-copy helper; timestamp randomizer                  |
| `src/services/crypto-file.service.ts`        | AES-256-GCM file encrypt/decrypt, SHA-256 hashing, hex helpers (Web Crypto only)                                 |
| `src/services/indexed-db.service.ts`         | `dmMessages` / `dmConversations` / key-announcement stores and the v20 migration                                  |
| `src/services/local-storage.service.ts`      | Typed accessors for DM-related keys (encryption privkey, client privkey, sync cursors, last-read, etc.)          |

### Components

| File                                              | Purpose                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `src/components/DmList/index.tsx`                 | Conversation list, Messages / Requests tabs, mute + trust filtering  |
| `src/components/DmMessageList/index.tsx`          | Message thread, reactions, replies, file rendering                   |
| `src/components/DmInput/index.tsx`                | Rich-text input, file upload, mentions, emoji autocomplete          |
| `src/components/DmRelayConfig/index.tsx`          | DM relay editor                                                      |
| `src/components/NewDeviceKeySync/index.tsx`       | New-device flow: publishes `4454`, subscribes to `4455`             |
| `src/components/KeySyncRequestDialog/index.tsx`   | Old-device flow: prompts to approve an incoming sync request         |
| `src/components/ResetEncryptionKeyButton/index.tsx` | Encryption key reset confirmation                                  |

### Pages

| File                                                    | Purpose                                               |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `src/pages/primary/DmPage/index.tsx`                    | Left-column DM home with setup wizard + conversation list |
| `src/pages/secondary/DmConversationPage/index.tsx`      | Right-column conversation thread                      |

### Hooks

| File                              | Purpose                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `src/hooks/useDmSupport.ts`       | Checks whether a target pubkey has DM relays + published encryption key        |
| `src/hooks/useDmUnread.ts`        | Cross-conversation unread count, honoring mute list and trust-score filtering |

### Routing

- Primary: key `'dms'` → `DmPage` (`src/routes/primary.tsx`)
- Secondary: path `'/dms/:pubkey'` → `DmConversationPage` (`src/routes/secondary.tsx`, `hideBottomBar: true`)
- Link helper: `toDmConversation(pubkey)` in `src/lib/link.ts` — encodes the pubkey as npub.

## Key flows

### Setup state machine (`DmPage`)

```
loading → need_login → need_relays → need_encryption_key → need_sync → ready
```

Implemented as `TSetupState` in `src/pages/primary/DmPage/index.tsx:27`.

- `loading` — checking local/remote state
- `need_login` — user not logged in
- `need_relays` — user has no `Kind 10050` published
- `need_encryption_key` — user has DM relays but no `Kind 10044` (offers to generate one)
- `need_sync` — a `Kind 10044` already exists remotely but no local privkey (offers Key Transfer)
- `ready` — has relays + local keypair, DM service initialized

**Fast path**: if a local keypair exists, `DmPage` enters `ready` immediately and then does a background `checkDmSupport` to detect key rotation on another device. If the remote `n` tag differs from the local pubkey, it drops the local key and re-enters `need_sync`.

### Sending a chat message

1. `DmInput` serializes content (mentions → `nostr:npub...`, custom emoji → `:shortcode:`).
2. `dmService.sendMessage(accountPubkey, recipientPubkey, content, replyTo?, additionalTags?)`:
   a. `getRecipientEncryptionPubkey(recipientPubkey)` fetches `Kind 10044` (or falls back to the encryption pubkey learned from an earlier received gift wrap, stored on the conversation record).
   b. `nip17GiftWrapService.createGiftWrappedMessage` produces `{ rumor, seal, giftWrap }`.
   c. `createGiftWrapForSelf` produces a second gift wrap addressed to the sender's own encryption pubkey.
   d. Message record is written to IndexedDB and added to the optimistic UI (`sending` status).
   e. Both gift wraps published in parallel — recipient-wrap to recipient DM relays, self-wrap to sender DM relays.
   f. Sending status transitions to `sent` (auto-cleared after 3s) or `failed`. `pendingPublishData` holds the payload so `resendMessage(id)` can retry without reconstructing.

### Sending a file

1. `cryptoFileService.encryptFile(blob)` → `{ encryptedBlob, key, nonce, originalHash }` (AES-256-GCM, 256-bit key, 12-byte IV, SHA-256 of plaintext).
2. Upload `encryptedBlob` to the configured Blossom / media service.
3. `dmService.sendFileMessage(...)` builds a `Kind 15` rumor whose `content` is the URL and whose tags carry the decryption metadata:
   ```
   ['file-type', mimeType]
   ['encryption-algorithm', 'aes-gcm']
   ['decryption-key', hexKey]
   ['decryption-nonce', hexNonce]
   ['ox', originalSha256Hex]
   ['dim', 'WxH']       // optional, images
   ['size', '<bytes>']  // optional
   ['thumbhash', '...'] // optional, base64 thumbhash for images
   ```
4. Same wrap + publish path as a chat message.

### Reactions

`dmService.sendReaction(accountPubkey, recipientPubkey, messageId, emoji, emojiTag?)` builds a `Kind 7` rumor (content = emoji or `:shortcode:`, tag `['e', messageId, relayHint]`, optional `['emoji', ...]`) and wraps it with the same NIP-17 pipeline. Reactions are saved as `TDmMessage` rows (same store) so they survive sync and are rendered as grouped chips under the target bubble. They are excluded from `lastMessageRumor` on conversations. There is no explicit "retract" event — removing a reaction means deleting the local row.

### Receiving messages

`dmService.init(accountPubkey, encryptionKeypair)` does two things:

1. **Sync past events** via `initMessages` using two independent cursors:
   - **Forward cursor**: `DM_LAST_SYNCED_AT_MAP[accountPubkey]` — the last time a full sync completed. On next init, fetch gift wraps with `since = lastSynced - DM_TIME_RANDOMIZATION_SECONDS` (2 days of slack for NIP-59 time randomization), paginated forward in batches of 1000.
   - **Backward cursor**: `DM_BACKWARD_CURSOR_MAP[accountPubkey]` — an `until` timestamp used to paginate older history. Set to `0` when the full history has been fetched (sentinel for "done").
2. **Open a live subscription** on the user's DM relays for:
   - `Kind 1059` with `#p: [accountPubkey]` — new gift wraps
   - `Kind 4454` authored by the user — incoming sync requests from other devices
   - `Kind 10044` authored by the user — encryption key rotation from another device

For each incoming gift wrap: `unwrapGiftWrap` → `createMessageFromUnwrapped` → `saveMessage` (always persists, no account filtering) → `updateConversation` (per-account), then emits `newMessage` / `newReaction`.

### Soft-deleting a conversation

`dmService.deleteConversation(accountPubkey, otherPubkey)`:

1. Loads the conversation record by `accountPubkey:otherPubkey`.
2. Sets `deleted = true`, `deletedAt = now`, `hasReplied = false`, `unreadCount = 0`; **message rows are never touched**.
3. Future reads (`getMessages`, `getConversations`) filter out messages with `createdAt ≤ deletedAt` and hide conversations where `deleted === true`.
4. If a new message arrives with `createdAt > deletedAt`, `updateConversation` sets `deleted = false` again but keeps `deletedAt`, so old history remains hidden. `hasReplied` is left `false`, so the resurrected conversation re-enters the **Requests** tab rather than the main list — the user must actively reply to trust it back into Messages.

This design is the reason dm messages are keyed by a symmetric **participants key** rather than an account-scoped conversation key — see the data model section.

### Multi-device Key Sync (Client Key / Key Transfer)

**New device** (no local encryption privkey, user clicks "Sync from another device"):

1. `publishClientKeyAnnouncement` publishes `Kind 4454` with `['client', <description>]`, `['pubkey', clientPubkey]`, `['P', clientPubkey]`. Both `pubkey` and `P` tags exist because different implementations pick different conventions — coop uses `pubkey`, the draft NIP uses `P`.
2. `subscribeToKeyTransfer` opens a subscription for `Kind 4455` events tagging `['p', clientPubkey]`.
3. When a `4455` arrives, `importKeyFromTransfer` NIP-44-decrypts its content with `(myClientPrivkey, senderClientPubkey)`. If the plaintext is a valid 32-byte hex, it's stored as the encryption privkey for the account.

**Old device** (has the encryption privkey, listening on its own DM relays for `Kind 4454` from the same user):

1. `dmService` sees the new `4454`, checks `PROCESSED_SYNC_REQUEST_IDS` to avoid re-prompting, then emits a `syncRequest` event.
2. `KeySyncRequestDialog` shows the new device's name and asks the user to approve.
3. On approval, `exportKeyForTransfer` builds a `Kind 4455`:
   - `content` = NIP-44(senderClientPrivkey, recipientClientPubkey, encryptionPrivkeyHex)
   - tags `[['P', senderClientPubkey], ['p', recipientClientPubkey]]`
   - Signed by the identity key, published to the user's own DM relays.
4. `markSyncRequestProcessed(eventId)` records the 4454 id so the prompt doesn't re-fire on the next init.

### Reading / unread tracking

- `setActiveConversation` / `clearActiveConversation` track which thread is currently open. `updateConversation` uses this to skip incrementing `unreadCount` for messages that arrive while the user is looking at the thread.
- `markConversationAsRead` writes `LAST_READ_DM_TIME_MAP[accountPubkey:otherPubkey] = now` and zeroes `unreadCount`.
- `useDmUnread` aggregates the unread count across conversations, filtering out muted pubkeys and applying trust-score filtering to the Requests tab.

## Data model

### `TDmMessage` (`src/types/index.d.ts`)

```ts
type TDmMessage = {
  id: string               // rumor id (NIP-01 event hash of the unsigned rumor)
  participantsKey: string  // sorted([pubkeyA, pubkeyB]).join(':') — symmetric, account-agnostic
  senderPubkey: string     // rumor.pubkey (real sender, NOT observer)
  content: string          // text for kind 14 / reactions, URL for kind 15
  createdAt: number        // rumor.created_at
  originalEvent: Event     // the gift wrap (kind 1059) actually published/received
  decryptedRumor: Event    // kind 14 / 15 / 7 rumor after unwrap
  replyTo?: {
    id: string
    content: string        // resolved lazily by resolveReplyTo()
    senderPubkey: string
    tags?: string[][]      // present for file replies (to recover mime / thumb)
  }
}
```

**Why `participantsKey`, not `conversationKey`?** Messages are deduplicated by rumor `id`, which is symmetric — the same message has the same hash from both endpoints. If we keyed the index by `accountPubkey:otherPubkey`, two accounts on the same device DMing each other would overwrite each other's rows and lose messages after an account switch. Sorting both pubkeys makes the key observer-independent.

### `TDmConversation`

```ts
type TDmConversation = {
  key: string              // `${accountPubkey}:${otherPubkey}` — account-scoped
  pubkey: string           // other party's main pubkey
  lastMessageAt: number
  lastMessageRumor?: Event // latest non-reaction rumor (drives preview text)
  unreadCount: number
  hasReplied: boolean      // drives Messages vs Requests classification
  encryptionPubkey?: string // learned from received gift wrap seals
  deleted?: boolean        // soft-delete flag; hidden from list when true
  deletedAt?: number       // unix seconds; messages older than this are permanently hidden for this account
}
```

Conversations are **per-account** even though messages are shared: each of the user's logged-in accounts has its own unread count, last-read pointer, deletion state, and learned encryption pubkey for the other party.

### `TEncryptionKeypair`

```ts
type TEncryptionKeypair = {
  privkey: Uint8Array      // raw 32 bytes, persisted as hex in LocalStorage
  pubkey: string           // lowercase hex, 64 chars
}
```

## IndexedDB schema (DB: `jumble`, version **20**)

`src/services/indexed-db.service.ts` is the authoritative reference. DM-relevant stores:

| Store                              | Key path   | Indexes                                                      |
| ---------------------------------- | ---------- | ------------------------------------------------------------ |
| `dmMessages`                       | `id`       | `participantsCreatedAtIndex` = `[participantsKey, createdAt]` |
| `dmConversations`                  | `key`      | `lastMessageAtIndex` = `lastMessageAt`                       |
| `dmRelaysEvents`                   | `key`      | —                                                            |
| `encryptionKeyAnnouncementEvents`  | `key`      | —                                                            |

### Migration history

- **v19** — cleared and resynced DMs after an earlier account-scoped key change.
- **v20** (current) — cursor-walks every `dmMessages` row to derive `participantsKey` from the old `conversationKey`, drops `conversationCreatedAtIndex`, creates `participantsCreatedAtIndex`, then cursor-walks `dmConversations` to migrate `localStorage.dmDeletedConversationsMap` onto the `deleted` / `deletedAt` fields (setting `deleted = lastMessageAt <= deletedAt` so a conversation with post-deletion activity is already resurrected on load). The localStorage key is removed afterwards. **No data is cleared.**

## LocalStorage keys (`src/constants.ts`, `StorageKey`)

| Key                        | Type                          | Purpose                                                                                                   |
| -------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ENCRYPTION_KEY_PRIVKEY_MAP` | `Record<accountPubkey, hex>` | Long-lived DM encryption privkey per account                                                              |
| `CLIENT_KEY_PRIVKEY_MAP`     | `Record<accountPubkey, hex>` | Per-device ephemeral keypair used as the Key Transfer bootstrap channel                                   |
| `LAST_READ_DM_TIME_MAP`      | `Record<accountPubkey:otherPubkey, unixSeconds>` | Drives `unreadCount` reset after `markConversationAsRead`                   |
| `DM_LAST_SYNCED_AT_MAP`      | `Record<accountPubkey, unixSeconds>` | Forward-sync cursor (`since` floor) — next init fetches `since = v - 2 days`                  |
| `DM_BACKWARD_CURSOR_MAP`     | `Record<accountPubkey, unixSeconds>` | Backward-sync cursor (`until` ceiling); `0` sentinel means history is complete              |
| `PROCESSED_SYNC_REQUEST_IDS` | `string[]` (cap'd)            | Remembered `Kind 4454` ids so the Key-Transfer approval dialog doesn't re-fire after refresh            |

All DM LocalStorage reads/writes go through `src/services/local-storage.service.ts`. The older `DM_DELETED_CONVERSATIONS_MAP` key was removed in v20 — do not reintroduce it.

## Service API surface (dm.service.ts)

The dm.service singleton is the single entry point other code touches. Key public methods (all under the default export):

```ts
init(accountPubkey, encryptionKeypair): Promise<void>
reinit(): Promise<void>
resetEncryption(): void
destroy(): void

// Sending
sendMessage(accountPubkey, recipientPubkey, content, replyTo?, additionalTags?): Promise<TDmMessage | null>
sendFileMessage(accountPubkey, recipientPubkey, fileUrl, mimeType, encryptionKey, encryptionNonce, originalHash, dim?, size?, thumbHash?): Promise<TDmMessage | null>
sendReaction(accountPubkey, recipientPubkey, messageId, emoji, emojiTag?): Promise<TDmMessage | null>
resendMessage(messageId): Promise<void>
getSendingStatus(messageId): 'sending' | 'sent' | 'failed' | undefined

// Reading
getConversations(accountPubkey): Promise<TDmConversation[]>  // filters out deleted
getConversation(accountPubkey, otherPubkey): Promise<TDmConversation | null>
getMessages(accountPubkey, otherPubkey, options?): Promise<TDmMessage[]>  // applies deletedAt filter
markConversationAsRead(accountPubkey, otherPubkey): Promise<void>
deleteConversation(accountPubkey, otherPubkey): Promise<void>  // soft delete

// Identity helpers
checkDmSupport(pubkey): Promise<{ hasDmRelays, hasEncryptionKey, encryptionPubkey }>
getRecipientEncryptionPubkey(pubkey): Promise<string | null>
getConversationKey(a, b): string         // 'a:b' — account-scoped, for dmConversations
getParticipantsKey(a, b): string         // sorted 'min:max' — symmetric, for dmMessages

// Sync / multi-device
importMessages(accountPubkey, rumors): Promise<number>  // bulk-import decrypted rumors (used by import tool)
resolveReplyTo(message): Promise<TDmMessage>            // lazily fills message.replyTo content/sender
markSyncRequestProcessed(eventId): void

// Active-conversation tracking (affects unread counting)
setActiveConversation(accountPubkey, otherPubkey): void
clearActiveConversation(accountPubkey, otherPubkey): void
isActiveConversation(accountPubkey, otherPubkey): boolean

// Listeners
onNewMessage(fn): unsubscribe
onNewReaction(fn): unsubscribe
onDataChanged(fn): unsubscribe
onSendingStatusChanged(fn): unsubscribe
onSyncRequest(fn): unsubscribe           // incoming Kind 4454 from other devices
onEncryptionKeyChanged(fn): unsubscribe  // remote Kind 10044 rotation observed
```

## Export / import

`DmPage` exposes Download / Upload buttons (`src/pages/primary/DmPage/index.tsx`). Export dumps all rumors for the account as newline-delimited JSON via `indexedDb.getAllDmMessagesForAccount(accountPubkey)` and filters the participantsKey by account inclusion. Import calls `dmService.importMessages(accountPubkey, rumors)`, which reuses the same save path as live messages (including `updateConversation`).

## Things to watch out for when reusing this code

1. **Always use `participantsKey` for message indexing, `conversationKey` for conversation indexing.** Mixing them is the exact bug v20 fixed.
2. **Gift wraps must carry two `p` tags.** `nostr-tools`' `nip59.wrapEvent` only writes one — use the custom `createGiftWrap` in `nip17-gift-wrap.service.ts`.
3. **Always randomize `created_at` for seal *and* gift wrap.** Using `dayjs().unix()` for either leaks timing.
4. **Self gift wraps are not optional.** Without them, the sender's other devices never see their own outgoing messages.
5. **The encryption privkey never touches the signer.** Only the three announcement/transfer events (10044, 4454, 4455) are signed by the identity key; everything else is signed by the encryption privkey (for seals) or an ephemeral key (for gift wraps).
6. **Soft-delete is per account, but messages are shared.** Filtering happens at read time using `conversation.deletedAt`. Never use `deleteDmMessagesByParticipantsKey` unless you are certain no other account on the device uses the same rows.
7. **Key rotation is detected at DmPage init, not proactively.** If you want push-driven detection, the relay subscription already listens to `Kind 10044` and emits `onEncryptionKeyChanged`; wire it into your UI.
8. **Forward-sync needs a 2-day slack.** Because NIP-59 randomizes `created_at` up to 2 days in the past, always subtract `DM_TIME_RANDOMIZATION_SECONDS` from the stored `lastSyncedAt` before using it as `since`.
9. **Relay-level DM support is a user-discoverable prerequisite.** `useDmSupport(pubkey)` checks both relays and encryption key and should gate any "Message" button in profile UIs.
