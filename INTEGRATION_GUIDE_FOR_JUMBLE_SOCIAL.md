# Spark Lightning Wallet Integration Guide for Jumble.social

**For:** Cody Tseng
**From:** Daniel (dmnyc)
**Date:** October 31, 2025
**Branch:** `breez-zapathon` (merged to master)

---

## 🎉 Executive Summary

The Jumble-Spark fork now has **full NIP-57 zap support** via Breez Spark SDK! This guide will help you integrate it into the main jumble.social deployment.

### What This Adds:
- ✅ **Trust-minimized Lightning wallet** for all users
- ✅ **Send zaps** from the Spark wallet (no external wallet needed)
- ✅ **Receive zaps** via Lightning addresses (`username@breez.tips`)
- ✅ **Automatic zap receipts** published to Nostr (NIP-57)
- ✅ **Multi-device sync** of wallet via encrypted Nostr backup (NIP-78)
- ✅ **Works in-browser** - WebAssembly, no native apps needed

---

## 🔑 **CRITICAL: You Need a Breez API Key**

The Spark SDK **requires a Breez API key** to function. This is free but must be obtained for each deployment.

### How to Get Your API Key

1. **Visit the API Key Request Form:**
   👉 **https://breez.technology/request-api-key/**

2. **Fill Out the Form:**
   - Project Name: `Jumble` (or `Jumble.social`)
   - Email: Your contact email
   - Use Case: Lightning wallet integration for Nostr client
   - Expected Users: [Your estimate]

3. **Receive Your Key:**
   - Breez will send you an API key (usually within 1-2 business days)
   - This is the **Nodeless Spark SDK** API key (not the Greenlight key)

4. **Free Tier:**
   - API keys are provided at **no cost**
   - No credit card required
   - Suitable for production use

---

## 📋 Integration Checklist

### 1. **Prerequisites**
- [x] Code merged to master (done!)
- [ ] Breez API key obtained (see above)
- [ ] Environment variable configured
- [ ] Deployment redeployed

### 2. **Add API Key to Environment**

#### For Vercel Deployment:

1. Go to your Vercel project dashboard:
   - https://vercel.com/[your-username]/jumble-social

2. Navigate to: **Settings** → **Environment Variables**

3. Add new environment variable:
   - **Name:** `VITE_BREEZ_SPARK_API_KEY`
   - **Value:** [Your API key from Breez]
   - **Environments:** ✅ Production ✅ Preview ✅ Development

4. Click **Save**

#### For Local Development:

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local`:
   ```bash
   VITE_BREEZ_SPARK_API_KEY=your_actual_api_key_here
   ```

3. The `.env.local` file is gitignored (won't be committed)

### 3. **Redeploy**

After adding the environment variable:

**Option A:** Push a new commit (triggers auto-deploy)

**Option B:** Manual redeploy
1. Go to **Deployments**
2. Click "..." on the latest deployment
3. Click **Redeploy**

### 4. **Verify Integration**

Once deployed, test the wallet:

1. Visit your deployed site (e.g., jumble.social)
2. Log in with Nostr
3. Navigate to **Settings** → **Wallet** (or wherever Spark UI is)
4. Try to:
   - Create a new Spark wallet (generates 12-word mnemonic)
   - Or restore existing wallet
   - Check that wallet connects successfully

5. Check browser console:
   - Should see: `[SparkService] SDK connected!`
   - Should NOT see: "API key not found" errors

---

## 🏗️ Architecture Overview

### How It Works

```
┌─────────────────────────────────────────────────────┐
│                  Jumble Frontend                     │
│  (React + Breez Spark SDK WebAssembly)              │
│                                                       │
│  ┌─────────────────────┐  ┌────────────────────┐   │
│  │ SparkWalletProvider │  │ ZapProvider        │   │
│  │ - Wallet connection │  │ - Zap UI/UX        │   │
│  │ - Balance updates   │  │ - Amount selection  │   │
│  │ - Payment monitoring│  │ - Comment handling  │   │
│  └─────────────────────┘  └────────────────────┘   │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ spark.service.ts                            │   │
│  │ - SDK connection with API key               │   │
│  │ - Send/receive payments                      │   │
│  │ - Lightning address registration            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
                         │ API Key Required
                         ▼
┌─────────────────────────────────────────────────────┐
│            Breez Spark Backend (Hosted)              │
│                                                       │
│  ┌─────────────────┐  ┌──────────────────────┐     │
│  │ Lightning Node  │  │ LNURL Server          │     │
│  │ - Payment routing│  │ - NIP-57 zap support │     │
│  │ - Channel mgmt  │  │ - @breez.tips domain │     │
│  └─────────────────┘  └──────────────────────┘     │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ Zap Monitoring (NEW in SDK 0.3.4!)          │   │
│  │ - Subscribes to user Nostr events           │   │
│  │ - Validates zap requests (kind 9734)        │   │
│  │ - Monitors invoice payment                   │   │
│  │ - Returns NIP-57 compliant LNURL responses  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
                  Lightning Network
                  & Nostr Relays
```

### Key Components

**Client-Side (Your Deployment):**
- `SparkWalletProvider.tsx` - Manages wallet lifecycle
- `spark.service.ts` - SDK wrapper (requires API key)
- `spark-storage.service.ts` - Encrypted local storage
- `spark-backup.service.ts` - Nostr cloud backup (NIP-78)
- `spark-zap-receipt.service.ts` - Publishes zap receipts (NIP-57)
- `lightning.service.ts` - Sends zaps

**Server-Side (Breez Hosted):**
- Lightning node infrastructure
- LNURL server with NIP-57 support
- Zap request validation
- Payment monitoring

---

## 🎯 User Experience Flow

### First-Time User

1. **User logs into Jumble** with Nostr extension
2. **Navigate to Wallet settings**
3. **Click "Create Spark Wallet"**
4. **System generates 12-word mnemonic**
5. **User backs up mnemonic** (critical!)
6. **Wallet connects** (requires API key)
7. **Register Lightning address** (optional): `username@breez.tips`
8. **Start sending/receiving zaps!**

### Returning User

1. **User logs in** with Nostr
2. **Wallet auto-restores** from encrypted storage
3. **Or restores from Nostr relays** (if on different device)
4. **Balance and payments sync automatically**

---

## 💰 Cost & Limits

### API Key Limits
- **Free tier:** Suitable for production use
- **No transaction fees** (just Lightning network routing fees)
- **No user limits** (as of documentation review)
- If you experience rate limiting, contact Breez for higher tiers

### Lightning Fees
- **Sending:** Standard Lightning routing fees (~0.1-1% typically)
- **Receiving:** No fees for receiving zaps
- **On-chain deposits:** Network fees apply (if users deposit from on-chain)

---

## 🔒 Security Considerations

### What's Encrypted

✅ **Mnemonic storage:**
- Local: XChaCha20-Poly1305 encryption with key derived from user's Nostr pubkey
- Nostr backup: NIP-04 self-encryption (encrypt to own pubkey)

✅ **API Key exposure:**
- The API key is intentionally exposed in browser (client-side SDK requirement)
- This is by design - the API key authenticates your app, not users
- Users' funds are secured by their mnemonic (which IS encrypted)

### What Users Must Protect

⚠️ **12-word mnemonic**
- Users MUST back up their mnemonic
- Loss = loss of funds (you cannot recover it)
- Consider UX prompts: "Have you backed up your mnemonic?"

### Best Practices

1. **Warn users during creation:**
   - "Back up your 12-word mnemonic NOW"
   - "We cannot recover your wallet if you lose it"
   - Consider making backup confirmation mandatory

2. **Multi-device sync:**
   - Nostr backup is automatic (encrypted on relays)
   - Users can access wallet from any device after logging in
   - Mnemonic is decrypted only on user's device

3. **Key rotation:**
   - If API key is compromised, request a new one from Breez
   - Update environment variable and redeploy
   - User wallets are NOT affected (secured by mnemonic)

---

## 📊 NIP-57 Zap Flow (NEW!)

### Receiving Zaps

This is the magic that just started working on Oct 31, 2025!

1. **User registers Lightning address:**
   - `alice@breez.tips` (via SDK)

2. **User adds to Nostr profile:**
   - Kind 0 event, `lud16: "alice@breez.tips"`

3. **Someone tries to zap Alice:**
   - Sender's client fetches: `https://breez.tips/.well-known/lnurlp/alice`
   - **Response now includes NIP-57 fields:** ✨
     ```json
     {
       "callback": "https://breez.tips/lnurlp/alice/invoice",
       "allowsNostr": true,          // ← NEW!
       "nostrPubkey": "npub1..."     // ← NEW!
       ...
     }
     ```

4. **Sender creates zap request:**
   - Kind 9734 event with amount, recipient, optional note

5. **Breez backend validates & creates invoice:**
   - Validates zap request signature
   - Checks amount is within limits
   - Creates Lightning invoice with zap request in description

6. **Payment completes:**
   - Sender pays invoice
   - **Breez monitors via Nostr subscription** 🎯
   - Payment hits Alice's wallet

7. **Zap receipt published:**
   - Your `SparkZapReceiptService` detects incoming payment
   - Extracts zap request from payment description
   - Publishes kind 9735 zap receipt to relays
   - **Everyone sees the zap in their feeds!** 🎉

### Sending Zaps

Already worked before, now even better:

1. User clicks "Zap" on a note
2. Selects amount (sats)
3. Optional comment
4. Spark wallet pays directly (no external wallet popup!)
5. Zap receipt appears in feed instantly

---

## 🧪 Testing Checklist

### After Integration

- [ ] **Environment variable set** (`VITE_BREEZ_SPARK_API_KEY`)
- [ ] **Deployment successful**
- [ ] **No console errors** about missing API key
- [ ] **Wallet creation works** (generates mnemonic)
- [ ] **Wallet restore works** (from mnemonic)
- [ ] **Multi-device sync works** (via Nostr backup)
- [ ] **Send payment works** (test with small amount)
- [ ] **Receive payment works** (have someone zap you)
- [ ] **Zap receipt published** (check Nostr relays, kind 9735)
- [ ] **Lightning address registration** works

### Test Scenarios

1. **New User Flow:**
   ```
   1. Create new wallet → Back up mnemonic
   2. Register Lightning address (e.g., "alice")
   3. Add to Nostr profile (lud16)
   4. Have friend zap you from different client
   5. Verify payment received
   6. Check zap receipt in feed
   ```

2. **Multi-Device Flow:**
   ```
   1. Create wallet on Device A
   2. Log out
   3. Log in on Device B (different browser/device)
   4. Wallet auto-restores from Nostr backup
   5. Balance and history appear correctly
   ```

3. **Zap Receipt Flow:**
   ```
   1. Register Lightning address
   2. Update Nostr profile with lud16
   3. Fetch LNURL response:
      curl https://breez.tips/.well-known/lnurlp/alice
   4. Verify response includes "allowsNostr": true
   5. Have someone zap you
   6. Check browser console for zap receipt logs
   7. Verify kind 9735 event published to relays
   ```

---

## 🐛 Troubleshooting

### "API Key Not Found" Error

**Symptom:** Console shows `[SparkService] API Key not found`

**Solution:**
1. Verify environment variable name is exactly: `VITE_BREEZ_SPARK_API_KEY`
2. Check it's enabled for correct environment (Production/Preview)
3. Trigger a new deployment (old builds cached without the variable)
4. For local dev, check `.env.local` file exists and has the key

### Wallet Connection Fails

**Symptom:** SDK fails to connect, timeout errors

**Solution:**
1. Check browser console for detailed error messages
2. Verify API key is valid (not expired/revoked)
3. Check Breez service status (rare outages)
4. Try with different network (regtest vs mainnet)
5. Ensure WebAssembly is enabled in browser

### Zaps Not Received

**Symptom:** Someone tries to zap but it fails

**Solution:**
1. Verify Lightning address is registered:
   ```javascript
   await sparkService.getLightningAddress()
   // Should return: { lightningAddress: "alice@breez.tips", ... }
   ```

2. Check LNURL response:
   ```bash
   curl https://breez.tips/.well-known/lnurlp/alice
   ```
   - Must include: `"allowsNostr": true`
   - Must include: `"nostrPubkey": "<hex>"`

3. Verify Nostr profile has lud16:
   - Fetch user's kind 0 event
   - Check for: `"lud16": "alice@breez.tips"`

4. Check sender's client logs (may be their issue)

### Zap Receipt Not Published

**Symptom:** Zap received but no kind 9735 event

**Solution:**
1. Check browser console for `[SparkZapReceipt]` logs
2. Common causes:
   - Payment description doesn't contain valid zap request
   - Zap request parsing failed (malformed JSON)
   - Relay publishing failed (check relay connection)
3. Verify payment details:
   ```javascript
   const payments = await sparkService.listPayments()
   console.log(payments[0].details.description) // Should be JSON
   ```

---

## 📚 Technical References

### Key Files Changed (for code review)

```
package.json                              # SDK version: 0.2.6 → 0.3.4
src/services/spark.service.ts             # parse() API, bigint amounts
src/components/SparkPaymentsList/index.tsx # bigint display formatting
BREEZ_NIP57_INTEGRATION.md                # Full technical details
NIP57_STATUS.md                           # Status & testing results
```

### External Documentation

- **Breez Spark SDK Docs:** https://sdk-doc-spark.breez.technology/
- **NIP-57 Specification:** https://github.com/nostr-protocol/nips/blob/master/57.md
- **NIP-78 Specification:** https://github.com/nostr-protocol/nips/blob/master/78.md
- **API Key Request:** https://breez.technology/request-api-key/
- **Breez SDK GitHub:** https://github.com/breez/spark-sdk

### Breaking Changes in SDK 0.3.x

**1. Amount Type Changed (v0.3.1):**
```typescript
// Old (v0.2.x):
amount: number

// New (v0.3.x):
amount: bigint

// Migration:
const amountSats = 1000;
const amount = BigInt(amountSats); // For SDK
const display = Number(amount);     // For UI
```

**2. Parse Function Moved:**
```typescript
// Old (v0.2.x):
import { parse } from '@breeztech/breez-sdk-spark/web'
const result = await parse(input)

// New (v0.3.x):
const result = await sdk.parse(input) // Now instance method
```

**3. Prepare Payment API:**
```typescript
// Old (v0.2.x):
prepareSendPayment({
  paymentRequest: invoice,
  amountSats: 1000  // number
})

// New (v0.3.x):
prepareSendPayment({
  paymentRequest: invoice,
  amount: 1000n  // bigint (note the 'n' suffix)
})
```

---

## 🚀 Deployment Strategy

### Recommended Approach

**Option A: Direct Merge (Recommended)**

Since the branch is already merged to master:

1. Obtain Breez API key
2. Add to Vercel environment variables
3. Push any commit to trigger deploy
4. Test thoroughly on production

**Option B: Gradual Rollout**

If you want to test first:

1. Deploy to preview environment with API key
2. Test all functionality
3. Get user feedback
4. Enable for production once confident

### Post-Deployment

1. **Announce the feature:**
   - Blog post / release notes
   - Social media (Nostr!)
   - Highlight: "Now you can send & receive zaps without external wallets!"

2. **Monitor for issues:**
   - Watch error logs (especially API key issues)
   - User reports of failed payments
   - Breez service status

3. **User education:**
   - Add help docs: "How to create a Spark wallet"
   - Mnemonic backup importance
   - Lightning address setup

---

## ✅ Success Criteria

You'll know the integration is successful when:

- ✅ Users can create Spark wallets in-app
- ✅ Users can send zaps without external wallets
- ✅ Users can register Lightning addresses
- ✅ Users receive zaps to their Lightning addresses
- ✅ Zap receipts automatically publish to Nostr
- ✅ Multi-device wallet sync works
- ✅ No API key errors in console
- ✅ User feedback is positive

---

## 🤝 Need Help?

### From Me (Daniel)
- GitHub: @dmnyc
- Branch: `breez-zapathon` (merged to master)
- Available for questions about the integration

### From Breez
- Docs: https://sdk-doc-spark.breez.technology/
- API Key Issues: contact@breez.technology
- Telegram: https://t.me/breezsdk

### From Nostr Community
- NIP-57 questions: nostr-protocol GitHub
- Test zaps: Ask on Nostr! (I'll zap you to test)

---

## 🎊 Conclusion

The Spark wallet integration brings Jumble to feature parity with major Nostr clients while maintaining self-custody. The timing is perfect - Breez just added NIP-57 support on October 31, 2025, and we integrated it the same day!

**Next Steps:**
1. Request your Breez API key → https://breez.technology/request-api-key/
2. Add to Vercel environment variables
3. Deploy and test
4. Launch! 🚀

Good luck with the integration! Feel free to reach out if you hit any snags.

— Daniel

---

**Appendix: Environment Variable Reference**

```bash
# .env.local (local development)
VITE_BREEZ_SPARK_API_KEY=your_api_key_here

# Vercel (production)
VITE_BREEZ_SPARK_API_KEY=your_api_key_here
# ✅ Enable for: Production, Preview, Development
```

**Appendix: Quick Links**

- ✅ **Get API Key:** https://breez.technology/request-api-key/
- 📖 **SDK Docs:** https://sdk-doc-spark.breez.technology/
- 🐛 **Report Issues:** https://github.com/breez/spark-sdk/issues
- 💬 **Get Support:** https://t.me/breezsdk
- 📋 **NIP-57 Spec:** https://github.com/nostr-protocol/nips/blob/master/57.md
