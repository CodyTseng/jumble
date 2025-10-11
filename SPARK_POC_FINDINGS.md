# Breez Spark SDK - POC Phase 1 & 2 Findings

**Date:** October 10, 2025
**Status:** Phase 2 Complete - Lightning Address Management Implemented

## Summary

Successfully integrated Breez Spark SDK v0.2.6 into Jumble. The POC demonstrates:
- ✅ SDK installation and WebAssembly initialization
- ✅ Service wrapper for SDK operations
- ✅ Test UI for manual validation
- ✅ Live testing completed with mainnet
- ✅ Lightning address registration and management
- ✅ Secure encrypted mnemonic storage
- ✅ Auto-wallet restoration
- ✅ Nostr profile synchronization
- 🔄 In Progress: UI redesign with tabbed interface

## Installation

**Package:** `@breeztech/breez-sdk-spark` v0.2.6
**Bundle Impact:**
- WASM file: **6.84 MB** (uncompressed)
- Main bundle increase: ~206 KB gzipped
- **Total app size: 1,018 KB gzipped** (vs ~812 KB before)

The WASM file is loaded on-demand, so initial page load isn't heavily impacted.

## Implementation Details

### Files Created

1. **`src/services/spark.service.ts`** - Main service wrapper
   - Initialization and connection management
   - Wallet operations (send/receive)
   - Balance and payment history
   - Lightning address registration

2. **`src/pages/secondary/SparkTestPage/index.tsx`** - Test UI
   - Connect/disconnect wallet
   - View balance
   - Generate invoices
   - Send payments
   - Access via: Settings → Wallet → "🧪 Spark SDK Test (POC)"

3. **Route additions** - Added `/spark-test` route

### SDK Architecture

The Spark SDK uses:
- **WebAssembly** for core Lightning functionality
- **IndexedDB** for storage (via storageDir parameter)
- **Seed-based** wallet creation (BIP39 mnemonic)

```typescript
// Connection flow
const config = defaultConfig('mainnet')
config.apiKey = YOUR_API_KEY

const seed = { type: 'mnemonic', mnemonic: '12 or 24 words' }

const sdk = await connect({
  config,
  seed,
  storageDir: 'jumble-spark-wallet'
})
```

## Key Findings

### ✅ What Works

1. **TypeScript Support** - Full type definitions included
2. **Browser Compatibility** - Uses web-specific exports
3. **Modular Design** - Clean separation of concerns
4. **Error Handling** - Comprehensive error types

### ⚠️ Challenges Discovered

1. **Mnemonic Generation**
   - SDK doesn't include BIP39 mnemonic generator
   - Needs external library: `npm install bip39`
   - For POC: Users must provide their own mnemonic

2. **Storage Architecture**
   - Uses IndexedDB via storageDir (not customizable storage provider)
   - Data persists in browser (need encryption strategy)
   - No built-in backup mechanism

3. **API Key Required**
   - Must obtain from Breez before testing
   - Free but requires registration

4. **Network Types**
   - Only `mainnet` and `regtest` supported
   - No `testnet` option

### 🔍 Still Unknown (Requires Testing)

1. **WebLN Compatibility**
   - BreezSdk class doesn't implement WebLN interface
   - May need adapter layer to work with existing `@getalby/bitcoin-connect`
   - Alternative: Replace entire wallet flow with Spark

2. **Lightning Address Format**
   - Need to verify if it generates standard addresses
   - Or if it uses Spark-specific format

3. **Initial Sync Time**
   - First connection might take time to sync
   - Need to test user experience

4. **Error Scenarios**
   - Insufficient balance handling
   - Network connectivity issues
   - Invoice expiry

5. **Payment Speed**
   - Is it fast enough for zaps?
   - Any noticeable delays?

## Testing Plan

### Prerequisites
1. Obtain Breez API key from: https://breez.technology/spark/
2. Generate a test mnemonic (12 words) using: https://iancoleman.io/bip39/
3. Fund the wallet with small amount for testing

### Test Scenarios

#### 1. Connection Test
- [ ] Navigate to Settings → Wallet → Spark SDK Test
- [ ] Enter API key
- [ ] Enter test mnemonic
- [ ] Click "Connect Spark Wallet"
- [ ] Verify connection succeeds
- [ ] Check balance displays

#### 2. Receive Test
- [ ] Click "Generate Test Invoice"
- [ ] Copy invoice
- [ ] Pay from external wallet
- [ ] Verify balance updates

#### 3. Send Test
- [ ] Generate invoice from external wallet
- [ ] Paste into "Send Payment" field
- [ ] Click "Send Payment"
- [ ] Verify payment succeeds
- [ ] Verify balance decreases

#### 4. Lightning Address Test
- [x] Check if Lightning address is automatically generated ✅
- [x] Implemented `registerLightningAddress()` method ✅
- [x] Verified address format: `username@breez.tips` ✅
- [x] Tested with user: `haxmedroom@breez.tips` ✅

#### 5. NIP-57 Zap Test
- [ ] Generate Spark invoice for 21 sats
- [ ] Try to pay via existing jumble zap flow
- [ ] Check if Spark can pay zaps from other users

---

## Phase 2: Lightning Address Management (October 10, 2025)

### ✅ Completed Features

#### 1. Lightning Address API Methods (`spark.service.ts`)
- **`checkLightningAddressAvailable(username)`** - Check if username is available before registration
- **`getLightningAddress()`** - Retrieve current Lightning address (already existed)
- **`registerLightningAddress(username, description?)`** - Register new Lightning address
- **`deleteLightningAddress()`** - Delete current Lightning address
- **`suggestAvailableUsername(preferredName)`** - Smart username suggestion with:
  - Sanitization (lowercase, alphanumeric + underscores only)
  - Automatic fallback with numeric suffixes if taken (e.g., `alice` → `alice1`, `alice2`)
  - Tries up to 999 variations before giving up
- **`setLightningAddress(username, description?)`** - Unified method to set/update address
  - Automatically deletes existing address if present
  - Registers new address in one call

#### 2. Auto-Registration Flow
- **Automatic username detection** from Nostr profile:
  1. First tries `original_username` (raw Nostr display name)
  2. Falls back to `username` (formatted username)
  3. Falls back to first 12 chars of npub
  4. Final fallback to 'user'
- **Auto-registration on connection**:
  - Checks if Lightning address already exists
  - If not, automatically suggests and registers one
  - Syncs to Nostr profile with user confirmation
- **User confirmation dialogs** before publishing profile updates
- Tested successfully with user `haxmedroom` → `haxmedroom@breez.tips`

#### 3. Profile Sync Safety Features (`spark-profile-sync.service.ts`)
- **Safety check**: Won't publish if no existing profile event (prevents creating blank profiles)
- **Data loss detection**: Aborts if update would reduce number of profile fields
- **User confirmation**: Asks permission before syncing Lightning address to Nostr profile
- **Debug logging**: Shows old and new profile content for troubleshooting
- **Preserves all existing profile fields** using spread operator

#### 4. UI Enhancements
- **Lightning Address Management Section**:
  - Display mode: Shows current address with Change/Delete buttons
  - Edit mode: Input field with real-time availability checking
  - Empty state: "Register Lightning Address" button if none exists
  - Change functionality with username validation
  - Delete functionality with confirmation
- **User feedback** via toast notifications for all operations
- **Loading states** for async operations

#### 5. Encrypted Storage Integration
- Mnemonic encrypted with XChaCha20-Poly1305 using Nostr pubkey
- Auto-restore wallet on page reload
- Wallet tied to user's Nostr account (can't be used by others)

### 🔍 Testing Results

**Test User:** haxmedroom
**Lightning Address:** `haxmedroom@breez.tips`
**Network:** Mainnet
**Status:** ✅ All features working

- ✅ Auto-registration picked up username correctly
- ✅ Lightning address change/delete works
- ✅ Profile sync with user confirmation works
- ✅ Profile data preserved (no data loss)
- ✅ Encrypted mnemonic storage and restoration works
- ✅ Balance updates automatically
- ✅ Payment animations work

### 📝 Files Modified/Created

**Modified:**
- `src/services/spark.service.ts` - Added Lightning address management methods (+108 lines)
- `src/services/spark-profile-sync.service.ts` - Added safety checks and logging
- `src/pages/secondary/SparkTestPage/index.tsx` - Added Lightning address UI and auto-registration (+275 lines)

**Created:**
- `src/components/SparkPaymentsList/index.tsx` - Payment history component (for Phase 3)

### ⚠️ Known Issues & Lessons Learned

1. **Profile data was lost during initial testing**
   - Cause: Synced to profile before safety checks were in place
   - Fix: Added multiple layers of safety (confirmation dialogs, data loss detection, safety checks)
   - Status: ✅ Resolved with comprehensive safety features

2. **Initial username fallback to 'user'**
   - Cause: Profile not loaded when registration ran
   - Fix: Improved username detection priority chain
   - Status: ✅ Resolved - now correctly uses Nostr username

3. **UI needs reorganization**
   - Current: Long scrolling page with all features mixed
   - Needed: Tabbed interface (Payments tab + Top-Up tab)
   - Status: 🔄 In progress

## Next Steps

### Phase 3: Lightning Address Payments (Completed ✅)
1. ✅ Updated `sendPayment()` method to support Lightning addresses
2. ✅ Implemented input type detection using `parse()` function
3. ✅ Added LNURL-Pay flow routing for Lightning addresses
4. ✅ Maintained backward compatibility with Bolt11 invoices
5. ✅ Added amount validation for Lightning address payments
6. ✅ Fixed `payRequest` structure extraction from parsed Lightning address
7. ✅ Added amount input field in UI (appears when `@` detected)
8. ✅ Successfully tested sending payments to Lightning addresses

**Key Implementation Details:**
- `parse(lightningAddress)` returns `{ type: 'lightningAddress', payRequest: LnurlPayRequestDetails }`
- Must extract `payRequest` field before passing to `prepareLnurlPay()`
- Amount is required for Lightning addresses (validated in both service and UI)
- Payment flow: parse → extract payRequest → prepareLnurlPay → lnurlPay

### Phase 4: UI Redesign (Pending)
1. ⏸️ Implement tabbed interface (Payments tab + Top-Up tab)
2. ⏸️ Add payment history list with scroll/pagination as primary view
3. ⏸️ Move Disconnect/Delete wallet to collapsible settings section
4. ⏸️ Improve mobile responsiveness

**Note**: UI redesign was attempted but reverted due to JSX complexity. Current UI is functional and includes all Phase 2 features (Lightning address management, encrypted storage, profile sync). UI improvements deferred to avoid regression.

### Short-term (Post-POC)
1. ~~Add BIP39 library for mnemonic generation~~ (Using external generator for now)
2. ~~Implement secure mnemonic storage (encrypted)~~ ✅ Completed
3. Create WebLN adapter if needed
4. Build proper wallet creation flow UI
5. Add seed backup/recovery UI with warnings
6. Test NIP-57 zap compatibility

### Medium-term (Full Integration)
1. Replace/complement Rizful flow with Spark option
2. Add toggle between wallet types
3. Integrate with existing zap functionality
4. ~~Payment history UI~~ 🔄 In progress
5. Balance display in main UI (not just test page)
6. ~~Lightning address auto-update to profile~~ ✅ Completed

### Long-term (Production)
1. Security audit of key storage
2. Comprehensive backup/recovery testing
3. Error handling improvements
4. Performance optimization
5. User education about self-custody
6. Rate limiting and abuse prevention
7. Multi-device wallet sync considerations

## Security Considerations

### ⚠️ Current POC Limitations
- Mnemonic stored in component state (memory only)
- No encryption at rest
- No password protection
- IndexedDB data not encrypted

### Production Requirements
- Encrypted local storage with user password
- Secure mnemonic backup flow
- Clear warnings about self-custody responsibility
- Option to export/import wallet
- Session timeout and auto-lock

## WebLN Compatibility Assessment

The Spark SDK `BreezSdk` class does **NOT** implement the WebLN interface natively.

**WebLN Interface Required Methods:**
```typescript
interface WebLNProvider {
  enable(): Promise<void>
  getInfo(): Promise<GetInfoResponse>
  sendPayment(invoice: string): Promise<SendPaymentResponse>
  makeInvoice(args: RequestInvoiceArgs): Promise<RequestInvoiceResponse>
  signMessage(message: string): Promise<SignMessageResponse>
  verifyMessage(signature: string, message: string): Promise<void>
  // ... more methods
}
```

**Spark SDK Methods:**
```typescript
class BreezSdk {
  getInfo(request: GetInfoRequest): Promise<GetInfoResponse>
  sendPayment(request: SendPaymentRequest): Promise<SendPaymentResponse>
  receivePayment(request: ReceivePaymentRequest): Promise<ReceivePaymentResponse>
  // Different API structure
}
```

**Options:**
1. **Create WebLN Adapter** - Wrapper class that translates WebLN calls to Spark SDK
2. **Replace WebLN Dependency** - Modify existing code to use Spark directly
3. **Hybrid Approach** - Spark for self-custody, keep WebLN for other wallets

## Recommended Approach

Based on POC findings, recommend **Option 3 (Hybrid)**:

1. Keep existing `@getalby/bitcoin-connect` for external wallets
2. Add Spark as alternative "self-custodial" option
3. Toggle in Wallet Settings: "Use Spark Wallet" vs "Use External Wallet"
4. Modify `lightning.service.ts` to check wallet type and route accordingly

This provides maximum flexibility and doesn't break existing functionality.

## Questions for User

1. Should users be able to switch between Spark and external wallets?
2. What's the preferred mnemonic backup flow?
3. Should we encrypt storage with user password?
4. Priority: Quick integration vs. Full security implementation?
5. Test on mainnet with real funds or wait for more stable release?

## Resources

- SDK Repository: https://github.com/breez/spark-sdk
- Documentation: https://sdk-doc-spark.breez.technology/
- API Docs: https://breez.github.io/spark-sdk/breez_sdk_spark/
- Demo App: https://breez-sdk-spark-example.vercel.app
- Get API Key: https://breez.technology/spark/

---

**Ready for testing with API key!**

Access test page at: http://localhost:5174/ → Settings → Wallet → "🧪 Spark SDK Test (POC)"
