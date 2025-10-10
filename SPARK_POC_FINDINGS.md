# Breez Spark SDK - POC Phase 1 Findings

**Date:** October 9, 2025
**Status:** Ready for Testing

## Summary

Successfully integrated Breez Spark SDK v0.2.6 into Juicebox. The POC demonstrates:
- ✅ SDK installation and WebAssembly initialization
- ✅ Service wrapper for SDK operations
- ✅ Test UI for manual validation
- ⏳ Pending: Live testing with API key

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
  storageDir: 'juicebox-spark-wallet'
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
- [ ] Check if Lightning address is automatically generated
- [ ] If not, try `registerLightningAddress()` method
- [ ] Verify address format

#### 5. NIP-57 Zap Test
- [ ] Generate Spark invoice for 21 sats
- [ ] Try to pay via existing jumble zap flow
- [ ] Check if Spark can pay zaps from other users

## Next Steps

### Immediate (Based on Testing)
1. Test with actual API key and funds
2. Document any errors or issues
3. Verify Lightning address functionality
4. Test zap compatibility

### Short-term (If POC Succeeds)
1. Add BIP39 library for mnemonic generation
2. Implement secure mnemonic storage (encrypted)
3. Create WebLN adapter if needed
4. Build proper wallet creation flow
5. Add seed backup/recovery UI

### Medium-term (Full Integration)
1. Replace Rizful flow with Spark option
2. Add toggle between wallet types
3. Integrate with existing zap functionality
4. Payment history UI
5. Balance display in main UI
6. Lightning address auto-update to profile

### Long-term (Production)
1. Security audit of key storage
2. Backup/recovery testing
3. Error handling improvements
4. Performance optimization
5. User education about self-custody

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

Access test page at: http://localhost:5173/ → Settings → Wallet → "🧪 Spark SDK Test (POC)"
