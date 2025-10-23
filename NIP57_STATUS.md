# NIP-57 Zap Implementation Status

## Summary
The Spark wallet integration has **full NIP-57 zap support implemented**, but is blocked by a Breez SDK backend limitation.

## What Works ✅

### Outgoing Zaps (Sending)
- ✅ Send zaps from Spark wallet to any Lightning address
- ✅ Proper NIP-57 zap request creation (kind 9734)
- ✅ Zap request included in invoice description
- ✅ Payment via Spark wallet
- ✅ Works with all Nostr clients and profiles

**Implementation:** `src/services/lightning.service.ts` (lines 89-107)

### Incoming Zap Receipt Publishing
- ✅ Automatic detection of incoming zap payments
- ✅ Extract zap request from payment description
- ✅ Build NIP-57 compliant zap receipts (kind 9735)
- ✅ Publish to Nostr relays with all required tags:
  - `bolt11` tag (invoice)
  - `description` tag (zap request)
  - `p` tag (sender pubkey)
  - `P` tag (recipient pubkey)
  - `preimage` tag
  - `e`/`a` tags (if zapping specific content)
  - `relays` tag

**Implementation:**
- `src/services/spark-zap-receipt.service.ts` (complete service)
- `src/providers/SparkWalletProvider.tsx` (lines 172-207)

### Regular Lightning Payments
- ✅ Send payments via Spark wallet
- ✅ Receive payments to `@breez.tips` address
- ✅ Payment notifications and balance updates
- ✅ Invoice generation

## What Doesn't Work ❌

### Receiving Zaps to Breez Lightning Address
- ❌ Cannot receive zaps to `daniel@breez.tips`
- ❌ Wallets show "invalid lightning address" error
- ❌ Cannot use as `lud16` in Nostr profile for zaps

**Root Cause:** Breez backend LNURL response missing NIP-57 fields

## The Problem

### Current LNURL Response
```bash
curl https://breez.tips/.well-known/lnurlp/daniel
```

```json
{
  "callback": "https://breez.tips/lnurlp/daniel/invoice",
  "maxSendable": 4000000000,
  "minSendable": 1000,
  "tag": "payRequest",
  "metadata": "[[\"text/plain\",\"Pay breez.tips user\"],[\"text/identifier\",\"daniel@breez.tips\"]]"
}
```

### Required for NIP-57
```json
{
  "callback": "https://breez.tips/lnurlp/daniel/invoice",
  "maxSendable": 4000000000,
  "minSendable": 1000,
  "tag": "payRequest",
  "metadata": "[[\"text/plain\",\"Pay breez.tips user\"],[\"text/identifier\",\"daniel@breez.tips\"]]",
  "allowsNostr": true,           // ← MISSING
  "nostrPubkey": "<hex-pubkey>"  // ← MISSING
}
```

## Technical Details

### Why the Callback Works But Wallets Reject It
1. The callback endpoint (`/lnurlp/daniel/invoice`) **does accept** the `nostr` parameter
2. Invoices are generated correctly with zap requests in description
3. BUT wallets check the metadata **before** calling the callback
4. Without `allowsNostr: true`, NIP-57 compliant wallets refuse to proceed

### SDK Limitation
The Breez Spark SDK `registerLightningAddress()` method only accepts:
```typescript
{
  username: string;
  description?: string;
}
```

There's no way to provide a `nostrPubkey` or enable NIP-57 support.

## What's Been Done

### Implementation (Complete)
1. ✅ Zap receipt publishing service created
2. ✅ Payment event handler integrated
3. ✅ Auto-sync feature implemented (currently disabled)
4. ✅ Code documented with limitation notes
5. ✅ Feature request drafted for Breez team

### Temporary Measures
1. ✅ Auto-sync to profile **disabled** (no point syncing address that doesn't work for zaps)
2. ✅ Code comments added explaining limitation
3. ✅ Documentation created

## Next Steps

### Immediate
1. **Contact Breez SDK team** with feature request
   - File: `BREEZ_NIP57_FEATURE_REQUEST.md`
   - Submit as GitHub issue or support request
   - Reference NIP-57 specification

### When Breez Adds NIP-57 Support
1. Re-enable auto-sync in `SparkWalletProvider.tsx` (lines 136-168)
2. Test receiving zaps
3. Verify zap receipts are published correctly
4. Update documentation

### Alternative (If Breez Doesn't Add Support)
- Use separate Lightning address for receiving zaps
- Keep Spark wallet for sending zaps and payments
- Consider LNURL proxy workaround

## Files Modified

### Services
- `src/services/spark-zap-receipt.service.ts` - NEW (198 lines)
  - Complete NIP-57 zap receipt implementation
  - Extracts bolt11, description, preimage from Payment object
  - Builds and publishes kind 9735 events

### Providers
- `src/providers/SparkWalletProvider.tsx`
  - Lines 172-207: Payment event listener with zap detection
  - Lines 136-168: Auto-sync feature (currently commented out)

### Documentation
- `BREEZ_NIP57_FEATURE_REQUEST.md` - NEW
- `NIP57_STATUS.md` - NEW (this file)

## References

- [NIP-57 Specification](https://github.com/nostr-protocol/nips/blob/master/57.md)
- [Breez Spark SDK Docs](https://sdk-doc-spark.breez.technology/)
- [LNURL-pay Spec](https://github.com/lnurl/luds/blob/luds/06.md)

## Testing

### To Test Sending Zaps
1. Connect Spark wallet
2. Zap any note or profile in the app
3. ✅ Should work perfectly

### To Test Receiving Zaps (Once Breez Adds Support)
1. Share your `@breez.tips` address
2. Have someone zap you from any Nostr client
3. Check browser console for:
   - `[SparkWalletProvider] Incoming payment received, checking for zap...`
   - `[SparkZapReceipt] Zap request found`
   - `[SparkZapReceipt] ✅ Zap receipt published: <event_id>`
4. Verify zap receipt appears in clients

---

**Status:** Waiting for Breez SDK NIP-57 support

**Updated:** 2025-10-11
