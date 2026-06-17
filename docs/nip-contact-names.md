# Private Contact Names

`draft` `optional`

A private, encrypted list mapping pubkeys to a user-chosen **name snapshot** —
the display name the author recorded for a contact at a point in time. Its
purpose is **rename / impersonation detection**: a client compares the recorded
name against the contact's current `kind:0` `name`/`display_name` and warns the
user when they diverge (e.g. an account whose key leaked and was renamed to
impersonate someone else).

This is **not** a NIP-02 follow list and **not** a NIP-51 follow set. It is a
standalone addressable event on a dedicated kind, and is independent of who the
author follows — a name may be recorded for any pubkey, followed or not.

## Event

- **Kind**: `33333` (addressable / parameterized-replaceable)
- **`d` tag**: `"contact-names"` (constant; one such list per author)
- **`content`**: a NIP-44 encryption of a JSON-stringified array of tags
  (the "entries"), encrypted by the author **to their own pubkey**
  (self-encryption, conversation key derived from the author's private key and
  their own public key). Legacy NIP-04 (detected by a `?iv=` substring) MAY be
  read for backward compatibility but MUST NOT be written.
- The public `tags` array carries only the `d` tag. No entry is ever placed in
  public tags — the list is private by definition.

### Entry format

Each entry inside the decrypted array is:

```
["p", "<pubkey-hex>", "<name>"]
```

- `<pubkey-hex>`: 32-byte lowercase hex public key of the contact.
- `<name>`: the recorded display-name snapshot. Implementations SHOULD strip
  control characters and MAY cap the length (Jumble caps at 80 chars).

Note the absence of a relay-hint slot: unlike NIP-02 `p` tags, element `[2]` is
the value itself, not a relay URL.

### Example (decrypted content, before encryption)

```jsonc
[
  ["p", "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d", "fiatjaf"],
  ["p", "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9", "ODELL"]
]
```

```jsonc
{
  "kind": 33333,
  "tags": [["d", "contact-names"]],
  "content": "<nip44-ciphertext of the array above>"
}
```

## Client behavior

- **Default display**: show the contact's **current** `kind:0` name. When a
  recorded name exists and differs, show an unobtrusive warning indicator.
- **Opt-in**: a client MAY offer a setting to display the recorded name in place
  of the current one. Jumble gates this behind `preferSavedContactNames`
  (default off).
- **Capture**: names are recorded explicitly by the user, or in bulk by
  snapshotting the current display names of the author's follow list.
- **Stability**: entries MUST NOT be pruned as a side effect of following or
  unfollowing. A re-follow MUST NOT overwrite an existing recorded name.
- Clients without the author's private key (e.g. public-key-only login) cannot
  decrypt the list and MUST fall back to current `kind:0` names.

## Related

- [Private Contact Notes](./nip-contact-notes.md) — freeform private comments,
  same kind, `d` = `"contact-notes"`.
