# Napplet runtime source

Adapted from [napplet-soy](https://github.com/zeSchlausKwab/napplet-soy), commit
`68ecb09c020097cbb4d45bdf344283e9becce038` (MIT). This directory contains the
selected protocol adapters, not the gallery, creator tools or platform services.
The license is retained here and distributed as `/napplet-runtime-LICENSE.txt`.
The upstream browser shim is pinned separately to `@napplet/shim@0.31.0`.

Local changes:

- Derive the artifact hash from the verified manifest when no separate catalog
  hash is supplied; legacy `x` tags identify the aggregate, not the HTML blob.

- Route relay reads and writes through `../relay.ts`,
  preserving Jumble's main-process WebSocket transport in Electron.
- Inject account-scoped persistent/session storage and a fixed account lifetime.
  Remove live identity rebinding; account changes destroy instances instead.
- Gate identity/resource disclosure through the Jumble permission UI.
- Brand-check uploaded binary data across iframe realms instead of using
  `instanceof`, and normalize accepted uploads into shell-owned Blobs. Intent
  payload quotas use the same realm-independent binary checks.
- Include the required `ok` flag in upload status snapshots and notifications,
  including completion, failure and cancellation.
- Accept numeric action names such as `common.decodeNip19` in the message envelope.
- Use the trusted carrier's event target and send function, retaining the actual
  opaque child window as message identity without weakening the main app's CSP.
- Allow ordinary `relay.publish` through the consent-controlled outbox publisher;
  reject application-supplied private-message envelopes.
- Add foreground intent host rebinding and account-transition disposal.
- Remove CVM and WebRTC domains, their sessions and ContextVM/MCP dependencies.
  Required unsupported domains fail loading; optional ones remain unavailable.
- Remove unused applesauce event-store APIs and loaders. OUTBOX reads use the
  Jumble relay adapter directly, preserving bounded advisory cache, per-relay
  coverage checks and cancellation.
- Pass structured signing snapshots to Jumble's approval UI, including upload
  metadata and exact destinations. Freeze host-generated mutation timestamps
  before consent and enforce prompt expiration when accepting a decision.
- Give approval a full 30 seconds, with separate host execution and iframe
  request deadlines. The pinned shim's OUTBOX, LISTS and COMMON timeout constants
  are adapted at injection; an execution test covers a delayed OUTBOX reply.
- Use the existing noble-hashes version and TypeScript-compatible typed arrays.
  Apply project formatting and input-validation lint annotations.
- Port configuration, keyboard and media tests to Vitest.

When updating, review upstream protocol/shim changes together, retain the local
account and authority boundaries, and run the complete test suite and both builds.
Domain exposure follows Jumble’s available capabilities, not the upstream runtime’s full profile or a
claim to implement every operation in every evolving NAP draft.
