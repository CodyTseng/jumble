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

## ✅ Session 2 Complete: Manage Members Tab Redesign (Nov 24, 2025)

### Implemented Features - Intake Form Design

#### **Section 1: User Search & Selection** ✅
- ✅ Search box supporting:
  - Username search (uses `useSearchProfiles` hook)
  - npub/nprofile input (auto-decodes)
  - Hex pubkey input (64-char validation)
  - NIP-05 identifier search
- ✅ Live search results dropdown with user profiles
- ✅ Click to add users to member table
- ✅ Duplicate detection prevents adding same user twice
- ✅ Auto-conversion from npub → hex pubkey

#### **Section 2: Member Intake Table** ✅
- ✅ Table with columns: Username | Alias | Public Key | Remove
- ✅ Username: Auto-populated from user's profile
- ✅ Alias: Editable text field (pre-filled with username)
- ✅ Public Key: Displays hex pubkey (truncated for readability)
- ✅ Remove button for each member
- ✅ Sequential member addition support

#### **Section 3: Live nostr.json Preview** ✅
- ✅ Fetches user's existing nostr.json from their NIP-05 domain
- ✅ Merges existing members with newly added members
- ✅ Real-time updates as members are added/removed
- ✅ Shows complete JSON structure ready to deploy
- ✅ Copy & Download buttons for easy export

### Technical Implementation

**New Components:**
- `MemberSearchInput` - Reusable search component with dropdown
  - Integrates `useSearchProfiles` hook
  - Handles npub/hex detection and conversion
  - Shows `UserItem` components in results

**Key Features:**
- Debounced search (500ms delay)
- Focus/blur state management for dropdown
- Keyboard support (Enter to add direct npub/hex)
- Toast notifications for feedback
- Responsive table layout

**Data Flow:**
1. User searches → `useSearchProfiles` fetches from local + remote relays
2. Click user → `userIdToPubkey` converts to hex → adds to members array
3. Edit alias → updates members array → regenerates JSON
4. Generate JSON → merges existing + new members → displays live preview

### Files Modified
- `/src/pages/secondary/CreateCommunityPage/index.tsx`
  - Completely redesigned `ManageMembersSection`
  - Added `MemberSearchInput` component
  - Removed manual pubkey input fields
  - Added table-based member management
  - Added existing nostr.json fetching

### Code Quality
- ✅ No TypeScript errors in CreateCommunityPage
- ✅ Proper imports (removed unused)
- ✅ Clean state management with React hooks
- ✅ Reuses existing components (`UserItem`, `useSearchProfiles`)
- ✅ Follows existing codebase patterns

---

## Future Enhancements (Optional)

### Deferred Features:
1. **Bulk Import** - CSV/text file import for multiple members
2. **Member Search** - Filter/search within added members table
3. **Username Validation** - Check for conflicts in alias names
4. **Profile Preview Modal** - Detailed profile view before adding

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
