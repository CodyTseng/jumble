# Private Contact Notes

`draft` `optional`

A private, encrypted list mapping pubkeys to a freeform **comment** the author
keeps about a contact — e.g. "met at Alice's party", "shilled a shitcoin in
2024". Purely for the author's own reference; never shown to anyone else.

Like [Private Contact Names](./nip-contact-names.md), this is a standalone
addressable event independent of the author's follow graph — a note may be kept
for any pubkey, followed or not.

## Event

- **Kind**: `33333` (addressable / parameterized-replaceable) — the same kind as
  Private Contact Names, distinguished by the `d` tag.
- **`d` tag**: `"contact-notes"` (constant; one such list per author)
- **`content`**: a NIP-44 encryption of a JSON-stringified array of entry tags,
  encrypted by the author **to their own pubkey** (self-encryption). Legacy
  NIP-04 (detected by a `?iv=` substring) MAY be read but MUST NOT be written.
- The public `tags` array carries only the `d` tag.

### Entry format

```
["p", "<pubkey-hex>", "<comment>"]
```

- `<pubkey-hex>`: 32-byte lowercase hex public key of the contact.
- `<comment>`: freeform text. Implementations SHOULD strip control characters
  (except newlines/tabs) and MAY cap the length (Jumble caps at 2000 chars).

Element `[2]` is the comment itself; there is no relay-hint slot.

### Example (decrypted content, before encryption)

```jsonc
[
  ["p", "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d", "met at the Berlin meetup"],
  ["p", "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9", "great podcast host"]
]
```

```jsonc
{
  "kind": 33333,
  "tags": [["d", "contact-notes"]],
  "content": "<nip44-ciphertext of the array above>"
}
```

## Client behavior

- Notes are shown only to the author, typically on the contact's profile.
- Entries MUST NOT be pruned as a side effect of following/unfollowing, and a
  re-follow MUST NOT overwrite an existing note.
- Clients without the author's private key cannot decrypt the list and simply
  show nothing.

## Related

- [Private Contact Names](./nip-contact-names.md) — recorded name snapshots for
  rename detection, same kind, `d` = `"contact-names"`.
