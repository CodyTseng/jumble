# Community Creation Feature - Development Plan

## Current Status: Instructions Page Complete ✅

### Completed Features (Session 1)

#### 1. Create Community Page Structure
- ✅ Added route `/communities/create` (placed before `/communities/:domain`)
- ✅ Created `CreateCommunityPage` component with tabbed interface:
  - Instructions tab
  - Manage Members tab
  - Join Requests tab (placeholder)

#### 2. Instructions Tab - COMPLETE
- ✅ **Step 1:** Create GitHub Repository
- ✅ **Step 2:** Create nostr.json File
  - Detailed GitHub web interface instructions
  - File structure diagram
  - Template with copy/download buttons
- ✅ **Step 3:** Add Community Favicon
  - Multiple format support (svg, png, ico)
  - Link to favicon.io
- ✅ **Step 4:** Add .nojekyll File (CRITICAL)
  - Dedicated step with clear instructions
  - Prevents Jekyll from ignoring .well-known directory
- ✅ **Step 5:** Enable GitHub Pages
  - Step-by-step GitHub settings guide
- ✅ **Step 6:** Custom Domain (Optional)
  - DNS configuration instructions
  - Link to GitHub custom domain documentation
- ✅ **Step 7:** Verify Your Setup
  - Domain verification with favicon + nostr.json checks
  - Detailed error messages with specific issues
  - Debug link to open nostr.json directly
  - Favicon preview even on partial success
  - Visual indicators (green for success, yellow for warnings, red for errors)

#### 3. UI Components
- ✅ Created Alert component (`/src/components/ui/alert.tsx`)
- ✅ Added "Create" button to My Community page titlebar

#### 4. Bug Fixes
- ✅ Fixed route ordering (specific routes before parameterized)
- ✅ Added support for multiple favicon formats in verification
- ✅ Fixed Jekyll .well-known directory issue with .nojekyll documentation

---

## Next Session: Manage Members Tab 🚧

### Current State
The Manage Members tab has basic functionality but needs significant improvements:
- ✅ Manual pubkey input (64-char hex validation)
- ✅ nostr.json generation with copy/download
- ✅ Member list display with remove functionality
- ❌ **No username lookup** - users must paste pubkeys manually
- ❌ **No profile preview** - can't verify before adding
- ❌ **No npub support** - only accepts hex pubkeys

### Required Features for Next Session

#### 1. Username/Pubkey Lookup
**Goal:** Allow searching for users by username/NIP-05 and automatically get their pubkey

**Implementation Plan:**
- Add search input field for username lookup
- Use existing `client.service.ts` user search functionality
  - `userIndex` (FlexSearch) for local search
  - Or search by NIP-05 identifier
- Display search results with profile previews
- Click to add user to member list

**Components to leverage:**
- `/src/services/client.service.ts` - `searchUser()` method
- `/src/hooks/useFetchProfile.ts` - Profile fetching
- `/src/components/UserAvatar` - Avatar display
- `/src/components/ProfileAbout` - Profile info display

#### 2. Profile Preview Before Adding
**Goal:** Show user's profile info before confirming addition

**Features:**
- Display avatar, username, NIP-05, about
- Preview what the NIP-05 identifier will be (username@domain)
- Confirm button to add to list

#### 3. npub Support
**Goal:** Accept both hex pubkeys and npub addresses

**Implementation:**
- Add npub to hex conversion using existing `/src/lib/pubkey.ts`
- Auto-detect format and convert
- Display both formats for user confirmation

#### 4. Enhanced Member Management UI
**Features to add:**
- Edit member username after adding
- Bulk import from CSV/text
- Duplicate detection
- Member count display
- Search/filter within added members

#### 5. Integration with User's Profile
**Goal:** Auto-suggest logged-in user as admin

**Implementation:**
- Pre-populate first member with current user's pubkey
- Use `useNostr()` hook to get current user's profile
- Suggest username from profile.username

---

## Future Sessions (Lower Priority)

### Join Requests Tab
- Create join request system using Nostr events
- Admin approval workflow
- Notification system for new requests

### GitHub Integration
- OAuth integration to create/update files directly
- Auto-commit changes to repository
- Real-time preview of community page

### Community Management
- Edit existing community
- Transfer ownership
- Community analytics (member growth, activity)

---

## Technical Notes

### Key Files
- `/src/pages/secondary/CreateCommunityPage/index.tsx` - Main component
- `/src/routes.tsx` - Route definitions (order matters!)
- `/src/pages/primary/MyCommunityPage/index.tsx` - "Create" button location
- `/src/components/ui/alert.tsx` - Alert UI component

### Services to Use for Next Session
- `/src/services/client.service.ts` - User search, profile fetching
- `/src/services/nip05-community.service.ts` - Community-related operations
- `/src/lib/pubkey.ts` - Pubkey/npub conversions
- `/src/hooks/useFetchProfile.ts` - Profile data fetching

### Current Branch
- Branch: `feature/community-creation`
- Ready to continue development
- Instructions tab fully tested and working

---

## Testing Checklist for Next Session

Before considering Manage Members complete:
- [ ] Search by username works
- [ ] Search by NIP-05 works
- [ ] Profile preview displays correctly
- [ ] npub addresses convert to hex
- [ ] Generated nostr.json is valid
- [ ] Duplicate members are detected
- [ ] Username editing works
- [ ] Member removal works
- [ ] Download/copy functionality intact
- [ ] Responsive design on mobile

---

## Known Issues
- None currently

## Dependencies
- All UI components available
- All services available
- No new dependencies needed
