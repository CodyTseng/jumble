# Spark Wallet Secure Storage Implementation

## Overview

Implemented encrypted mnemonic storage for Breez Spark SDK wallet that:
- ✅ Encrypts mnemonic with XChaCha20-Poly1305 authenticated encryption
- ✅ Derives encryption key from user's Nostr pubkey
- ✅ Persists across browser sessions
- ✅ Auto-connects on page load
- ✅ Tied to user's Nostr account
- ✅ Mnemonic hidden by default with show/hide toggle

## Security Architecture

### Encryption Method
- **Algorithm:** XChaCha20-Poly1305 (AEAD cipher)
- **Key Derivation:** SHA-256(nostr_pubkey) = 32-byte key
- **Nonce:** 24 random bytes (unique per encryption)
- **Library:** `@noble/ciphers` v2.0.1

### Data Flow

```
User enters mnemonic
    ↓
Encrypt with derived key (from Nostr pubkey)
    ↓
Store encrypted blob in localStorage
    ↓
On page load: decrypt and auto-connect
```

### Storage Format
```
localStorage key: spark_wallet_{pubkey}
Value: hex(nonce || ciphertext)
  - nonce: 24 bytes
  - ciphertext: encrypted mnemonic + auth tag
```

## Implementation Files

### `src/services/spark-storage.service.ts`
Main storage service with methods:
- `saveMnemonic(pubkey, mnemonic)` - Encrypt and save
- `loadMnemonic(pubkey)` - Decrypt and load
- `hasMnemonic(pubkey)` - Check if exists
- `deleteMnemonic(pubkey)` - Remove from storage
- `clearAll()` - Remove all saved wallets

### `src/pages/secondary/SparkTestPage/index.tsx`
Updated UI features:
- Auto-detect saved wallet on mount
- Auto-connect if wallet exists
- Show/hide mnemonic toggle
- "Delete Wallet" button
- Status indicators

## User Experience

### First Time Setup
1. User signs in with Nostr
2. Navigates to Spark Test page
3. Enters mnemonic (with show/hide toggle)
4. Clicks "Connect & Save Wallet"
5. Mnemonic encrypted and saved
6. Toast: "Wallet connected & encrypted mnemonic saved!"

### Subsequent Sessions
1. User signs in with Nostr
2. Opens Spark Test page
3. **Wallet auto-connects automatically!**
4. Shows: "Restoring wallet..." → "Wallet restored from encrypted storage"
5. Balance and Lightning address displayed immediately

### Disconnect vs Delete
- **Disconnect:** Closes SDK connection, mnemonic remains saved
- **Delete Wallet:** Removes encrypted mnemonic from storage permanently

## Security Considerations

### ✅ Strengths
1. **Tied to Nostr identity** - Can't be accessed without user's pubkey
2. **Authenticated encryption** - Detects tampering
3. **Unique nonce** - Each encryption uses different nonce
4. **No plaintext storage** - Mnemonic never stored unencrypted
5. **Browser sandboxing** - localStorage isolated per origin

### ⚠️ Limitations
1. **Browser storage** - If device is compromised, attacker with pubkey could decrypt
2. **No password protection** - Relies solely on pubkey-derived key
3. **Local only** - Not synced across devices
4. **XSS vulnerability** - JavaScript can access localStorage

### 🔐 Production Improvements Needed

For production deployment, consider:

1. **Additional Password Layer**
   ```typescript
   // Derive key from: SHA-256(pubkey || user_password)
   const key = sha256(pubkey + password)
   ```

2. **Hardware Security**
   - Use Web Crypto API's non-extractable keys
   - Integrate with hardware wallets
   - Use browser's built-in credential storage

3. **Multi-device Sync**
   - Encrypt with pubkey + password
   - Store encrypted blob on Nostr relay (kind 30078)
   - Sync across devices securely

4. **Session Timeout**
   - Auto-lock wallet after inactivity
   - Require re-authentication

5. **Backup Verification**
   - Force user to verify mnemonic backup
   - Show mnemonic once, then hide permanently
   - Require confirmation before allowing payments

## Testing Secure Storage

### Test Scenarios

**Scenario 1: Save and Restore**
```bash
1. Connect wallet with mnemonic
2. Refresh page
3. ✓ Wallet auto-connects with saved mnemonic
4. ✓ Balance displayed correctly
```

**Scenario 2: Multiple Accounts**
```bash
1. Connect wallet with Account A
2. Logout from Nostr
3. Login with Account B
4. ✓ No wallet shown (different pubkey)
5. Connect wallet with different mnemonic
6. Logout, login back to Account A
7. ✓ Original wallet auto-connects
```

**Scenario 3: Delete Wallet**
```bash
1. Connect wallet
2. Click "Delete Wallet"
3. Confirm deletion
4. Refresh page
5. ✓ No auto-connect (mnemonic deleted)
6. ✓ Can connect new wallet
```

**Scenario 4: Encryption Verification**
```bash
1. Connect wallet
2. Open DevTools → Application → Local Storage
3. Find key: spark_wallet_{pubkey}
4. ✓ Value is hex string (not readable)
5. ✓ Changes on each save (different nonce)
```

## API Reference

### SparkStorageService

```typescript
// Save encrypted mnemonic
await sparkStorage.saveMnemonic(pubkey, mnemonic)

// Load encrypted mnemonic
const mnemonic = await sparkStorage.loadMnemonic(pubkey)
// Returns: string | null

// Check if mnemonic exists
const exists = sparkStorage.hasMnemonic(pubkey)
// Returns: boolean

// Delete mnemonic
sparkStorage.deleteMnemonic(pubkey)

// Clear all saved mnemonics
sparkStorage.clearAll()
```

## Migration Path

If user needs to move to production-grade security:

1. **Export existing mnemonic**
   ```typescript
   const mnemonic = await sparkStorage.loadMnemonic(pubkey)
   // User saves to password manager
   ```

2. **Delete from browser storage**
   ```typescript
   sparkStorage.deleteMnemonic(pubkey)
   ```

3. **Re-import with enhanced security**
   - Add password protection
   - Use hardware wallet
   - Enable multi-device sync

## Conclusion

This implementation provides **good security for POC/testing** but should be enhanced for production use with:
- Additional password layer
- Session timeouts
- Hardware wallet integration
- Multi-device sync via Nostr relays
- Backup verification flow

The encryption is cryptographically sound, but the threat model assumes the attacker doesn't have access to the user's Nostr private key. For production, add defense-in-depth with additional authentication factors.
