# Community Join Request Workflow

## Overview

This document describes the implementation of the community join request feature for Seewaan's NIP-05 domain-based communities.

**Branch:** `feature/community-join-requests`

## What is This Feature?

Seewaan treats verified NIP-05 domains (like @nostr.build, @stacker.news) as communities. This feature allows:
- **Users** to request joining a community
- **Admins** to review and approve requests from followed users
- **Automatic detection** when a request is approved (user added to nostr.json)

## Key Design Decisions

### 1. NIP-05 Communities (Not Traditional Nostr Communities)
- Communities are defined by NIP-05 verified domains
- Members are users verified under that domain in `.well-known/nostr.json`
- Only domains serving the **full** nostr.json file are considered communities

### 2. No Technical "Approval" Process
- There is no approve/reject button in the UI
- Approval happens when admin adds user's pubkey to nostr.json file
- System auto-detects approval by periodically checking nostr.json

### 3. Follow-Based Filtering
- Only requests from users **followed by the admin** are shown
- This ensures well-connected communities and filters spam
- Both user and admin receive instructions about this requirement

### 4. Admin is First Pubkey
- The first pubkey in nostr.json is considered the admin
- Join requests are sent to this admin's relays
- Admin sees requests in the "Create A Community" page

## Implementation Details

### Event Kind
- **Kind:** `39457` (addressable event range 30000-39999)
- **d-tag:** Domain name (makes requests addressable per user per domain)
- **p-tag:** Admin pubkey (for targeting the request)
- **Tags:** `domain` tag for easier querying

### Data Flow

#### User Side (Sending Request)
1. User clicks "Request to Join" on community page
2. Check if full nostr.json is available (required)
3. Create kind 39457 event with domain and admin pubkey
4. Publish to admin's write relays + big relays
5. Show "Request Sent" button
6. Display warning if admin doesn't follow user

#### Admin Side (Viewing Requests)
1. Navigate to "Create A Community" → "Join Requests" tab
2. Fetch kind 39457 events where admin is tagged (#p)
3. Filter to only show requests from followed users
4. For each request:
   - Display user profile and message
   - Show timestamp
   - Provide "Copy Pubkey" button
   - Auto-check nostr.json every 30s
   - Show "Approved" badge when user appears in nostr.json

#### Approval Detection
1. Periodic check (30s) refreshes community members from nostr.json
2. Manual "Check Status" button for immediate refresh
3. Visual feedback during checks (spinner)
4. Green highlight + "Approved" badge when detected
5. Toast notification on approval

## File Changes

### New/Modified Files

**Constants & Types:**
- `src/constants.ts` - Added `COMMUNITY_JOIN_REQUEST: 39457`
- `src/types/index.d.ts` - Added `TCommunityJoinRequest` type

**Business Logic:**
- `src/lib/draft-event.ts` - Added `createCommunityJoinRequestDraftEvent()`
- `src/services/nip05-community.service.ts` - Uses existing `getDomainMembers()` and `refreshCommunityMembers()`

**UI Components:**
- `src/components/Nip05Community/index.tsx` - Added "Request to Join" button with warnings
- `src/pages/secondary/CreateCommunityPage/index.tsx` - Replaced "Coming Soon" with real implementation

**Translations:**
- `src/i18n/locales/en.ts` - Added 20+ English strings
- `src/i18n/locales/ar.ts` - Added 20+ Arabic translations

## User Experience

### For Users Requesting to Join

**What They See:**
- "Request to Join" button on community pages
- "Request Sent" confirmation after sending
- Warning if admin doesn't follow them
- Instructions to follow admin

**What They Need to Do:**
1. Follow the community admin (recommended)
2. Click "Request to Join"
3. Wait for admin to add them to nostr.json
4. Update their profile with NIP-05 identifier

### For Admins Reviewing Requests

**What They See:**
- "Join Requests" tab in "Create A Community" page
- List of pending requests from followed users
- Auto-updating approval status
- Copy pubkey button for easy addition

**What They Need to Do:**
1. Review request from followed user
2. Add user's pubkey to domain's nostr.json file
3. System auto-detects and marks as approved
4. (Optional) Notify user via DM or other means

## Security & Spam Prevention

### Follow-Based Filtering
- **Problem:** Open requests could lead to spam
- **Solution:** Only show requests from users admin follows
- **Benefit:** Ensures web of trust, maintains community quality

### One Request Per Domain Per User
- **Problem:** Users could spam multiple requests
- **Solution:** Addressable events (d-tag = domain) replace previous requests
- **Benefit:** Clean, deduplicated request list

### No Auto-Approval
- **Problem:** Automated approval could be exploited
- **Solution:** Manual addition to nostr.json required
- **Benefit:** Admin has full control over membership

## Future Enhancements (Phase 5+)

### Notification System
Currently marked with TODO comments in code:

**Potential Approaches:**
1. **DM Notification (NIP-04):** Send encrypted DM when approved
2. **Reply/Mention:** Post public reply to join request event
3. **Custom Notification Event:** Use NIP-51 or custom kind
4. **Notification Relay:** Subscribe to dedicated notification relay

**Implementation Notes:**
- See TODOs in `CreateCommunityPage/index.tsx` (line ~1010)
- See TODOs in `Nip05Community/index.tsx` (line ~325)

### Other Ideas
- Batch approval UI for admins
- Request message/introduction customization
- Request expiration after N days
- Declined request reasons
- Community member invitation system

## Testing Checklist

### User Flow
- [ ] Click "Request to Join" on community page
- [ ] Verify event is published to correct relays
- [ ] Check "Request Sent" state persists on page reload
- [ ] Verify warning appears when admin doesn't follow user
- [ ] Test with already-member status (shows "Member" badge)

### Admin Flow
- [ ] Navigate to "Create A Community" → "Join Requests"
- [ ] Verify only requests from followed users appear
- [ ] Copy pubkey and add to test nostr.json
- [ ] Wait for auto-detection (30s) or click "Check Status"
- [ ] Verify "Approved" badge appears
- [ ] Test with no requests (shows empty state)

### Edge Cases
- [ ] Community without full nostr.json (button shouldn't appear)
- [ ] Multiple requests from same user (should replace, not duplicate)
- [ ] Request when not logged in (shows login prompt)
- [ ] Admin who doesn't follow requester (request hidden)
- [ ] Invalid/unreachable domain (graceful error handling)

## Commits Summary

1. **11aec7a** - Add event kind, types, and request creation (Phase 1 & 2)
2. **3452003** - Implement admin request viewing with filtering (Phase 3)
3. **e148bf5** - Add i18n translations (English & Arabic)
4. **22bdbfa** - Add auto-detection and status refresh (Phase 4)
5. **2fd48cd** - Add user instructions and warnings
6. **673ee3a** - Add Phase 5 notification placeholders

## Architecture Notes

### Why Addressable Events?
- One request per user per domain (no spam)
- Easy to query: `{kinds: [39457], authors: [userPubkey], '#d': [domain]}`
- Can be updated/replaced if user wants to change message

### Why Filter by Following List?
- Maintains web of trust
- Prevents spam from unknown users
- Ensures community cohesion
- Admin likely already knows/trusts requester

### Why No Approve Button?
- Keeps process simple and transparent
- Approval is adding to nostr.json (domain-level action)
- Auto-detection provides immediate feedback
- Avoids dual state management (UI + nostr.json)

## Related Documentation

- **NIP-05:** https://github.com/nostr-protocol/nips/blob/master/05.md
- **Addressable Events:** https://github.com/nostr-protocol/nips/blob/master/01.md#kinds
- **Seewaan Architecture:** See `CLAUDE.md` for overall architecture
- **Community Feature:** See `README.md` section on NIP-05 Communities

## Questions & Answers

**Q: Why not use NIP-72 (moderated communities)?**
A: Seewaan's model is domain-based, simpler, and leverages existing NIP-05 infrastructure.

**Q: Can users see their pending requests?**
A: Currently no dedicated view. TODO for Phase 5. Users can verify by checking the community page for "Request Sent" status.

**Q: What if admin doesn't use Seewaan?**
A: They won't see the requests in UI, but events are on relays. They could build alternative tooling to query kind 39457 events.

**Q: Can there be multiple admins?**
A: Currently first pubkey is admin. Future enhancement could tag all members as potential approvers.

**Q: How to revoke membership?**
A: Remove from nostr.json. System will detect on next refresh.
