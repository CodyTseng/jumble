# Spark Wallet Backup: NIP-04 to NIP-44 Migration Guide

## Overview

This document explains the migration from NIP-04 to NIP-44 encryption for Spark wallet backups, the security improvements, and how the migration process works seamlessly for users.

## Why Upgrade from NIP-04 to NIP-44?

### NIP-04 Security Issues
- **Weak encryption**: Uses AES-256-CBC with non-hashed ECDH key
- **Not IND-CPA secure**: Vulnerable to chosen plaintext attacks
- **Poor key derivation**: Direct use of ECDH shared secret without proper hashing
- **Deprecated standard**: Community moved away from NIP-04 due to security concerns

### NIP-44 Security Improvements
- **Modern cipher**: Uses ChaCha20-Poly1305 with authenticated encryption
- **Proper key derivation**: HKDF-based key derivation from ECDH shared secret
- **IND-CCA2 secure**: Resistant to both chosen plaintext and ciphertext attacks
- **Better cryptanalysis resistance**: Immune to known attacks on NIP-04
- **Current standard**: Recommended by Nostr community for encrypted content

## Migration Strategy

### Automatic Migration (Zero User Action Required)

The migration is **completely automatic** and transparent to users:

1. **Backward Compatibility**: All code can still decrypt NIP-04 backups
2. **Automatic Detection**: System detects encryption version from backup tags
3. **Transparent Upgrade**: On first load, NIP-04 backups are automatically migrated
4. **No Data Loss**: Old backup remains accessible until migration completes
5. **Graceful Fallback**: If migration fails, old backup still works

### How It Works

#### 1. Creating New Backups (NIP-44)
```typescript
// New backups use NIP-44 by default
const encryptedContent = await client.signer.nip44Encrypt(pubkey, mnemonic)

// Event includes encryption version tag
tags: [
  ['d', 'spark-wallet-backup'],
  ['client', 'Jumble'],
  ['description', 'Encrypted Spark wallet backup'],
  ['encryption', 'nip44']  // ← Version tracking
]
```

#### 2. Loading Backups (Automatic Migration)
```typescript
async loadFromNostr() {
  // 1. Fetch backup event
  const backupEvent = await fetchBackupEvent()

  // 2. Detect encryption version from tags
  const encryptionTag = backupEvent.tags.find(tag => tag[0] === 'encryption')
  const version = encryptionTag?.[1] || 'nip04'  // Default to nip04 for old backups

  // 3. Decrypt using appropriate method
  if (version === 'nip44') {
    mnemonic = await signer.nip44Decrypt(pubkey, content)
  } else {
    // Old NIP-04 backup detected
    mnemonic = await signer.nip04Decrypt(pubkey, content)

    // 4. AUTOMATIC MIGRATION: Re-save with NIP-44
    await this.saveToNostr(mnemonic)  // Creates new NIP-44 backup
  }

  return mnemonic
}
```

#### 3. File Backups (Version Tracking)
```json
{
  "version": 2,  // v1 = NIP-04, v2 = NIP-44
  "type": "spark-wallet-backup",
  "encryption": "nip44",
  "pubkey": "<user's pubkey>",
  "encryptedMnemonic": "<nip44 encrypted>",
  "createdAt": 1234567890,
  "createdBy": "Jumble"
}
```

## Migration Timeline

### Phase 1: Implementation (Current)
- ✅ Add NIP-44 support to all signer implementations
- ✅ Update backup service to use NIP-44 for new backups
- ✅ Implement automatic migration on load
- ✅ Add encryption version detection

### Phase 2: Deployment
- Deploy to production
- All new backups automatically use NIP-44
- Existing users transparently migrated on next wallet access

### Phase 3: Monitor (Post-Deployment)
- Monitor migration success rate
- Check for any NIP-04 decryption failures
- Verify all users successfully migrated

### Phase 4: Deprecation (6+ months)
- After confirming all users migrated
- Can optionally remove NIP-04 decryption code
- Currently keeping for maximum compatibility

## User Experience

### What Users See
**Nothing changes!** The migration is completely invisible:

```
User opens wallet → App detects NIP-04 backup → Decrypts → Migrates → Done
```

**Console logs (for debugging):**
```
[SparkBackup] Detected encryption version: nip04
[SparkBackup] ⚠️  Found legacy NIP-04 backup, decrypting...
[SparkBackup] 🔄 Migrating backup to NIP-44...
[SparkBackup] ✅ Backup successfully migrated to NIP-44
[SparkBackup] Backup loaded and decrypted from Nostr
```

### Error Handling

If migration fails, the wallet still works:
```typescript
try {
  await this.saveToNostr(mnemonic)
  console.log('✅ Backup successfully migrated to NIP-44')
} catch (migrationError) {
  // User's wallet still works with NIP-04 backup
  console.warn('⚠️  Migration to NIP-44 failed (backup still works):', migrationError)
}
```

## Technical Details

### Event Structure Comparison

**NIP-04 Backup (Old):**
```json
{
  "kind": 30078,
  "content": "<base64_encrypted_content>?iv=<iv>",
  "tags": [
    ["d", "spark-wallet-backup"],
    ["client", "Jumble"],
    ["description", "Encrypted Spark wallet backup"]
  ]
}
```

**NIP-44 Backup (New):**
```json
{
  "kind": 30078,
  "content": "<base64_encrypted_content>",
  "tags": [
    ["d", "spark-wallet-backup"],
    ["client", "Jumble"],
    ["description", "Encrypted Spark wallet backup"],
    ["encryption", "nip44"]  // ← Version tag
  ]
}
```

### Encryption Algorithms

| Feature | NIP-04 | NIP-44 |
|---------|--------|--------|
| Cipher | AES-256-CBC | ChaCha20-Poly1305 |
| Key Derivation | Raw ECDH X-coordinate | HKDF with salt |
| Authentication | None (CBC mode) | Poly1305 MAC |
| Padding | PKCS#7 | None (stream cipher) |
| IV/Nonce | 16 bytes (random) | 32 bytes (random) |
| Format | `<ciphertext>?iv=<iv>` | `<version><nonce><ciphertext><mac>` |
| Security Level | Weak | Strong (IND-CCA2) |

### Signer Implementation

All signer types support both NIP-04 and NIP-44:

- **NsecSigner**: Direct implementation with `nostr-tools`
- **Nip07Signer**: Delegates to browser extension (with feature detection)
- **BunkerSigner**: Delegates to remote signer via NIP-46
- **NostrConnectionSigner**: Delegates via NIP-46 connection
- **NpubSigner**: Read-only (throws error for encryption)

## Testing the Migration

### Test Scenarios

1. **New User (No Existing Backup)**
   - Creates wallet → Backup saved with NIP-44 ✅

2. **Existing User with NIP-04 Backup**
   - Opens wallet → Detects NIP-04 → Migrates to NIP-44 ✅

3. **User with File Backup (v1)**
   - Restores from file → Detects v1 → Decrypts with NIP-04 ✅
   - System suggests creating new backup for NIP-44

4. **Multi-Device User**
   - Device A: Has NIP-04 backup
   - Device A: Migrates to NIP-44
   - Device B: Fetches NIP-44 backup automatically ✅

## Security Considerations

### No Breaking Changes
- All NIP-04 backups remain valid
- No forced migration or user action required
- Dual support for both encryption methods

### Migration is One-Way
- Once migrated to NIP-44, backup uses new format
- Old clients (without NIP-44 support) cannot decrypt
- This is acceptable since we're in early preview

### Key Rotation Not Included
- Migration re-encrypts with same Nostr key
- Does not implement key rotation (future enhancement)
- Shared secret remains the same

## Monitoring & Metrics

### Recommended Tracking
```typescript
// Track migration events
analytics.track('backup_migration', {
  from: 'nip04',
  to: 'nip44',
  success: true,
  timestamp: Date.now()
})

// Track encryption version distribution
analytics.track('backup_loaded', {
  encryption_version: 'nip44',
  timestamp: Date.now()
})
```

### Success Metrics
- % of users successfully migrated
- Time to complete migration
- Migration failure rate
- NIP-04 vs NIP-44 backup distribution

## Rollback Plan

If issues arise, rollback is simple:

```typescript
// Temporarily revert to NIP-04 for new backups
const encryptedContent = await client.signer.nip04Encrypt(pubkey, mnemonic)

// Remove encryption tag
tags: [
  ['d', 'spark-wallet-backup'],
  ['client', 'Jumble'],
  ['description', 'Encrypted Spark wallet backup']
  // ['encryption', 'nip44']  ← Remove this
]
```

All existing code still works since both methods are supported.

## Future Enhancements

### Phase 5: Additional Security Features
1. **Password-based local encryption** (replacing `SHA256(pubkey)`)
2. **Backup verification checksums** (tamper detection)
3. **Key rotation mechanism** (periodic re-encryption)
4. **Private relay support** (AUTH-required relays)
5. **Multi-signature backups** (require multiple keys)

## References

- [NIP-04 Specification](https://github.com/nostr-protocol/nips/blob/master/04.md)
- [NIP-44 Specification](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-78 Specification](https://github.com/nostr-protocol/nips/blob/master/78.md) (Application Data Storage)
- [nostr-tools v2.17.0](https://github.com/nbd-wtf/nostr-tools) (NIP-44 support)

## Conclusion

The NIP-04 → NIP-44 migration provides significant security improvements with zero user friction. The automatic migration ensures all users benefit from enhanced encryption without requiring any manual steps or risking data loss.

**Key Benefits:**
- ✅ Stronger encryption (ChaCha20-Poly1305)
- ✅ Better security properties (IND-CCA2)
- ✅ Zero user action required
- ✅ Backward compatible
- ✅ Graceful error handling
- ✅ Production-ready for early preview users
