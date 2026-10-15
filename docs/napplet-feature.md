# Napplets (NIP-5D)

Jumble displays napplet manifests as static cards and opens them at
`/napplets/<NIP-19 event reference>`. Cards and one-line previews never execute
application code. The protocol adapter source was adapted from napplet-soy commit
`68ecb09c020097cbb4d45bdf344283e9becce038`; see the vendored source's README and MIT
license for provenance and local adaptations.

## Bookmarks

The runtime titlebar can add or remove the current app in the account's existing
NIP-51 kind-10003 bookmark list. Named/root apps use `a` coordinates and follow
updates; snapshots use pinned `e` references. Other bookmarks and encrypted list
content are preserved. Writes are serialized per account, use monotonically
increasing timestamps, and cancel pending signing or routing before broadcasting
when the originating account is retired.

Napplets use the existing Bookmarks page. There is no separate napplet collection,
discovery page or sidebar entry. Static cards open the app and have no bookmark
control of their own.

## Verification and sandbox

The loader verifies the manifest signature, validates its shape, checks every
required `R` domain locally, downloads the single HTML artifact from Blossom and
verifies its raw SHA-256 before decoding or injecting any runtime code. The
supported current manifest kinds are 5129, 15129 and 35129. The pinned parser
also accepts the upstream legacy single-file format, without falling back from
an invalid current-format manifest to legacy parsing. Optional `O` domains do
not prevent opening. Snapshots have their own event-ID scope.

A static, trusted same-origin carrier (`public/napplet-host.html`) is required
because `srcdoc` inherits its parent's CSP. This carrier has a separate policy;
Jumble's main document retains its existing script restrictions. The carrier
contains the **actual untrusted napplet iframe**, which uses only
`sandbox="allow-scripts"` and verified `srcdoc`. The outer carrier is trusted
application code and uses `allow-scripts allow-same-origin` so the shell can
attach a listener to its window. Never place untrusted HTML in the outer frame.

The host listens in the carrier realm and verifies each message's source against
the actual inner iframe window. Its send callback also runs in the carrier realm,
so the shim sees its actual parent as the message sender. This is not a
payload-token or origin-based identity scheme. Unknown sources/types are dropped.
The injected CSP blocks direct fetch/WebSocket connections, workers and nested frames. No
`window.nostr`, private key or general-purpose signing primitive is exposed.

Icons are optional: verified manifest hash, downloaded hash, byte MIME and image
decoding must all agree. Failure falls back to generic artwork. Icon loading is
lazy and respects the profile-picture loading preference.

## Account environments and lifecycle

An instance captures the account pointer (public key and signer type), signer,
relay configuration and cancellation signal. Its asynchronous handlers never
resolve the current global signer on demand. Storage is scoped by account,
publisher/manifest coordinate (or snapshot ID), artifact hash, and optionally
instance ID. Configuration is account-scoped too.
Guests use their own namespace. Account grants are not inherited.

Account transitions synchronously retire every instance before awaiting another
signer. Closing or navigating away destroys the iframe, closes reads,
and media, aborts requests and dismisses permissions.
Hidden pages in PageManager's navigation stack do not retain runners. There is
no napplet background mode. Reopening creates a fresh instance and fresh grants;
persisted account data remains.

The exact captured signer is checked before signing and the account lifetime is
checked again after asynchronous signing, before publication. An extension or
remote signer may finish an already-issued request after cancellation; its late
signature must not start a new broadcast. Already-dispatched network writes
cannot be recalled.

## Runtime capabilities

| Domains            | Behavior                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| shell, theme, keys | Runtime readiness, Jumble theme updates and focused keyboard actions                           |
| identity           | Public key/profile/list queries with session-local user approval before disclosure             |
| storage, config    | Account/artifact-scoped key-value storage, instance data and schema-driven settings            |
| relay, outbox      | Bounded reads/subscriptions, routing and user-confirmed publication                            |
| common, lists      | Public helpers and confirmed follow/reaction/report/list mutations                             |
| resource           | Bounded data/HTTPS/Blossom bytes, origin approval, hash and MIME verification                  |
| link               | Confirmed HTTPS navigation with no opener                                                      |
| fs                 | Per-instance virtual filesystem, explicit native file-copy selection and user-triggered export |
| upload             | Confirmed Blossom upload using the account's configured Blossom servers                        |
| media              | Shell-owned audio controls, bounded sessions and cleanup                                       |
| intent             | Manifest-advertised handler discovery and foreground handoff; no background target runtime     |

Presence of a domain does not imply unlimited operations. Unsupported modes,
schemes, event kinds, absent providers, read-only accounts and user-denied
operations return the pinned runtime's policy errors. In particular, raw signing,
app-supplied encrypted messages, arbitrary host filesystem access, video media
sessions and direct networking are not granted. CVM and WebRTC are not exposed.
Manifests requiring either domain are rejected; optional declarations do not
prevent loading. Requests in unexposed domains are silently ignored.

Browser resource downloads use credential-free, CORS-checked requests, reject
redirects and block literal private/local addresses. As in the reference browser
runtime, browser code cannot inspect DNS resolution to enforce an absolute
private-address guarantee. The implementation is not a full NAP-RESOURCE
conformance claim. Do not blindly expose Electron's generic HTTP proxy to an
iframe to bypass these checks.

## Signing approval

Signing prompts show the requesting app, captured signing account, operation,
content preview and exact destinations. Expandable event details expose the full
unsigned event and an explicit copy action; app text is rendered literally.
Publication and upload authorization receive structured host-owned snapshots,
not a parsed prose description. Host-generated list mutations choose their
signed timestamp before asking, so the approved payload matches the signed one.

Decisions remain per-request with a 30-second approval window. Closing, rejection,
expiration or account retirement
cannot approve a pending request. The host owns the deadline; the refusal button
shows its remaining seconds without rerendering event details. Signing operations and the iframe binding leave additional time for signing and
relay delivery after approval. Approval is not autofocused. A constrained scrolling body keeps the action row visible on mobile,
and entering a dialog exits fullscreen so its controls remain reachable.

## Implementation dependencies

Relay reads and writes use Jumble's `SmartPool` / `ElectronPool`, including the
main-process relay transport on desktop. Signing uses the captured Jumble account
signer, storage uses account-scoped host storage, and upload servers and theme
come from Jumble's settings. The adapter adds permission and lifecycle checks at
the sandbox boundary rather than introducing another account or relay stack.

No ContextVM, MCP or applesauce packages are required. `@napplet/shim` supplies
the iframe-side protocol binding; RxJS bridges cancellable NAP subscriptions to
Jumble's relay callbacks, and `ipaddr.js` validates network address policy. The
remaining event cache is bounded, session-local advisory data and does not
establish relay coverage or publication authority.

## Validation

Run `npm test`, `npm run lint`, `npm run build` and
`ELECTRON=true npx vite build --config vite.electron.config.ts`.

Security regressions cover manifest/artifact tampering, missing required domains,
account/publisher/version/instance storage separation, denied and delayed
identity requests, resource cancellation, publication refusal, late signatures
and virtual filesystem traversal. Upstream-derived tests cover configuration,
keyboard behavior and audio lifecycle.

Browser smoke checks should use signed fixture manifests and intercepted relays
and Blossom responses, with disposable test accounts. Check all exposed domains,
the actual inner sandbox, permission refusal/approval, one approved publication,
storage and permissions after account switching, page-stack navigation, returning from an app,
reload, settings, mobile layout and Arabic RTL. Use synthetic keys only.
