# Breez Spark SDK NIP57 Zap Integration

**Date:** October 31, 2025
**SDK Version:** 0.3.4
**Branch:** `breez-zapathon`

## Executive Summary

Breez has successfully implemented NIP57 zap support in their Spark SDK backend! PR #317 "Nostr Zap support" was merged on October 31, 2025. This document details our integration of the new zap functionality into Jumble-Spark.

## What Changed in Breez Spark SDK

### PR #317: Nostr Zap Support (Merged Oct 31, 2025)

The Breez team added server-side zap handling to their LNURL backend:

1. **Database Layer**: New `zaps` table stores zap requests and tracks invoice payments
2. **Nostr Integration**: Added nostr-sdk 0.43.0 for monitoring user events
3. **Smart Subscriptions**: Just-in-time subscription model that only monitors when open zap invoices exist
4. **LNURL Enhancement**: Lightning addresses now return NIP57-compliant LNURL responses with:
   - `allowsNostr: true`
   - `nostrPubkey: <hex-pubkey>`
5. **Zap Validation**: Backend validates zap requests before creating invoices
6. **Automatic Monitoring**: Server subscribes to user events and watches zap payments until completion

### PR #364: Nostr Zap Fixes (Open, Not Merged Yet)

Bug fixes and improvements:
- Querystring handling for nostr events
- Relay tag correction (Relays vs Relay)
- Code refactoring for maintainability

## Implementation Approach

### Key Discovery: Server-Side Implementation

The zap support is implemented **entirely in the backend LNURL server**, not in the client SDK. This means:

✅ **No client-side changes needed for zap receiving**
✅ **Existing Lightning address registration works as-is**
✅ **Backend automatically adds NIP57 support**
✅ **Our existing zap receipt service should work**

### SDK Changes We Made

#### 1. Upgraded SDK Version
```json
"@breeztech/breez-sdk-spark": "^0.3.4"  // was 0.2.6
```

#### 2. Fixed Breaking Changes

**a) Amount Type Migration (v0.3.1)**
- Changed from `number` to `bigint` for all amounts
- Updated `PrepareSendPaymentRequest.amount` (was `amountSats`)

**b) Parse Function**
- Moved from standalone function to SDK instance method
- Was: `await parse(input)`
- Now: `await this.sdk.parse(input)`

**c) Files Updated:**
- `src/components/SparkPaymentsList/index.tsx` - bigint handling
- `src/services/spark.service.ts` - parse() and amount changes

## How NIP57 Zaps Now Work

### Backend Flow (Automatic)

1. **Lightning Address Registration**
   - User registers `username@breez.tips` via SDK
   - Backend automatically associates with user's wallet

2. **LNURL Response Enhancement**
   - When someone fetches `https://breez.tips/.well-known/lnurlp/username`
   - Backend returns NIP57-compliant response with `allowsNostr` and `nostrPubkey`

3. **Zap Request Handling**
   - Sender creates NIP-57 zap request (kind 9734)
   - Sends to callback URL with zap request in `nostr` parameter
   - Backend validates zap request
   - Creates invoice with zap request in description

4. **Payment Monitoring**
   - Backend subscribes to user's Nostr events
   - Monitors invoice until paid or expired
   - Auto-cleanup when complete

### Client Flow (Our Code)

1. **Receiving Zaps**
   - No changes needed! Lightning address registration works as-is
   - Backend handles all NIP57 requirements

2. **Zap Receipts**
   - Our existing `SparkZapReceiptService` publishes receipts
   - Listens for incoming payments
   - Extracts zap request from payment description
   - Publishes NIP-57 zap receipt (kind 9735) to Nostr relays

3. **Sending Zaps**
   - Already works perfectly
   - Uses existing `lightningService.sendZap()` method

## Testing Checklist

### Before Testing
- [x] SDK upgraded to 0.3.4
- [x] Code builds successfully
- [x] Breaking changes resolved

### Manual Testing Required

1. **Register Lightning Address**
   - [ ] Connect Spark wallet
   - [ ] Register a Lightning address
   - [ ] Verify registration succeeds

2. **Verify LNURL Response**
   - [ ] Fetch `https://breez.tips/.well-known/lnurlp/{username}`
   - [ ] Confirm response includes:
     - `"allowsNostr": true`
     - `"nostrPubkey": "<hex-pubkey>"`

3. **Receive Test Zap**
   - [ ] Share your `@breez.tips` address
   - [ ] Have someone zap you from a Nostr client
   - [ ] Verify zap payment received
   - [ ] Check browser console for zap receipt publishing logs

4. **Verify Zap Receipt**
   - [ ] Check that zap receipt (kind 9735) was published to relays
   - [ ] Verify zap appears in sender's client
   - [ ] Confirm all required tags are present (bolt11, description, p, P, preimage, etc.)

5. **Send Zaps** (Already Works)
   - [ ] Send a zap from Jumble-Spark
   - [ ] Verify it completes successfully

## Profile Sync (Optional Enhancement)

Currently commented out in `SparkWalletProvider.tsx:136-168`. To enable:

1. Uncomment the auto-sync code
2. Test that Lightning address syncs to Nostr profile (lud16 field)
3. Add UI toggle for users to control this setting

## Files Modified

### Core Changes
- `package.json` - SDK version bump
- `src/services/spark.service.ts` - API updates for v0.3.4
- `src/components/SparkPaymentsList/index.tsx` - bigint handling

### Existing Zap Infrastructure (No Changes Needed)
- `src/services/spark-zap-receipt.service.ts` - Already implements NIP-57 receipts
- `src/providers/SparkWalletProvider.tsx` - Already monitors payments
- `src/services/lightning.service.ts` - Sending zaps works

### Documentation
- `NIP57_STATUS.md` - Needs update to reflect working status
- `BREEZ_NIP57_FEATURE_REQUEST.md` - Can be archived
- `BREEZ_NIP57_INTEGRATION.md` - This file (new)

## Next Steps

1. **Manual Testing**
   - Run through the testing checklist above
   - Document any issues found
   - Verify zap receipts are published correctly

2. **Profile Sync Decision**
   - Decide if we want auto-sync enabled
   - If yes, add user preference toggle
   - If no, remove commented code

3. **Documentation Updates**
   - Update `NIP57_STATUS.md` with test results
   - Remove old limitation warnings from code comments
   - Add user-facing documentation for receiving zaps

4. **Deployment**
   - Create pull request
   - Get user testing feedback
   - Merge to main

## Breaking Changes Summary

For future reference, SDK 0.3.x introduced:

1. **Amounts are now bigint** (v0.3.1)
   - All amount fields changed from `number` to `bigint`
   - Use `BigInt()` constructor when passing amounts
   - Use `Number()` when converting for display

2. **parse() is now a method** (unknown version)
   - Changed from standalone to instance method
   - Update: `parse(input)` → `this.sdk.parse(input)`

3. **prepareSendPayment uses 'amount'** (unknown version)
   - Parameter renamed from `amountSats` to `amount`
   - Note: `prepareLnurlPay` still uses `amountSats`

## Technical Notes

### Why No Client-Side Zap APIs?

The Rust implementation (PR #317) shows that zap handling requires:
- Persistent Nostr connections to monitor events
- Database to track zap requests and invoices
- Background processing for subscription management

These are server-side concerns. The client SDK simply:
- Registers Lightning addresses
- Sends/receives payments
- Gets payment notifications

The LNURL backend server handles:
- Adding NIP57 metadata to responses
- Monitoring for zap payments
- Managing subscriptions

### Nostr Integration Details

From PR #317 code review:
- Uses `nostr-sdk` 0.43.0 with NIP57 support
- Subscriptions created per user with open invoices
- Smart cleanup when invoices expire/complete
- Zap requests validated before invoice creation
- Event monitoring via nostr-relay-pool

## Conclusion

The integration is **much simpler than expected** because Breez implemented zaps server-side. Our main work was:

1. Upgrading the SDK (done ✅)
2. Fixing breaking changes (done ✅)
3. Testing that it works (pending)

Our existing zap receipt publishing code should work without modifications once we verify the backend is providing the necessary data.

---

**Status:** Ready for testing
**Next Action:** Manual testing with real Spark wallet
