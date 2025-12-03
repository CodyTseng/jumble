# Upstream Features to Consider

This document tracks interesting features from the upstream Jumble repository that could be implemented in Seewaan.

## Feature List

### 1. NIP-43 Relay Authentication & Membership
**Upstream commits:** 850d92d, e464207, 9a90f37, etc.
**Description:** Support for paid/private relays with invite codes and relay authentication
**Status:** Not implemented
**Priority:** Medium
**Notes:** Requires RelayMembershipControl components, relay-membership.service, and NIP-43 support

### 2. Profile Search
**Upstream commit:** 72d43cc
**Description:** Search through user profiles using FlexSearch
**Status:** Already exists in codebase
**Priority:** N/A (complete)

### 3. PageRank Spam Detection / Trust Scores
**Upstream commits:** c84c479, 68ecbb2
**Description:** Display trust scores for users based on PageRank algorithm
**Status:** Not implemented
**Priority:** Medium
**Notes:** Requires TrustScoreBadge component and trust-score.service

### 4. Follow Packs (NIP-51)
**Upstream commit:** b21855c
**Description:** Create and share curated lists of users to follow
**Status:** Not implemented
**Priority:** High
**Notes:** Requires FollowPackPage and follow pack kind support

### 5. Addressable Videos (NIP-71)
**Upstream commit:** 65d4439
**Description:** Support for addressable video events (kinds 34235, 34236)
**Status:** Not implemented
**Priority:** Low
**Notes:** Extends video functionality with addressable events

### 6. Custom Emojis (NIP-30)
**Upstream commits:** 82c1300, 1e2385d
**Description:** Support for custom emoji packs in posts
**Status:** Not implemented
**Priority:** Low
**Notes:** Requires EmojiPack components, TextWithEmojis, custom-emoji.service

### 7. Deduplicated Reposts
**Upstream commit:** 222527e
**Description:** Reduce feed noise by deduplicating identical reposts
**Status:** Not implemented
**Priority:** High
**Notes:** Improves feed UX by showing each note only once

### 8. Media Upload Improvements
**Upstream commits:** 7ac4e74, f5ee0cb, 8e30ba8
**Description:** Enhanced NIP-96 media upload with better UX
**Status:** Partially implemented
**Priority:** Medium
**Notes:** Upstream has improved upload progress and error handling

### 9. Long-form Content Improvements
**Upstream commits:** e6d8d47, 7c0a42a, 2cec6bb
**Description:** Better rendering and navigation for long-form articles
**Status:** Partially implemented
**Priority:** Medium
**Notes:** Upstream has improved article formatting and metadata display

### 10. Live Events (NIP-53)
**Upstream commits:** 8c44224, 94c44ca
**Description:** Support for live streaming events
**Status:** Not implemented
**Priority:** Low
**Notes:** Requires LiveEvent components and subscription handling

### 11. Relay Reviews
**Upstream commit:** f402b87
**Description:** User reviews and ratings for relays
**Status:** Not implemented
**Priority:** Medium
**Notes:** Requires RelayReview component and kind 31987

### 12. IValue Proof-of-Work
**Upstream commit:** 4daf95c
**Description:** Display proof-of-work difficulty on events
**Status:** Not implemented
**Priority:** Low
**Notes:** Shows event mining difficulty as quality signal

## Implementation Approach

Based on the cherry-pick experience, the best approach is to **implement features from scratch** rather than cherry-picking upstream commits. This avoids:
- Complex merge conflicts in i18n files (17 languages)
- Missing dependencies between commits
- Incompatibilities with Seewaan's NIP-05 communities architecture

### Recommended Implementation Order

1. **Follow Packs** - High value, complements communities feature
2. **Deduplicated Reposts** - Improves UX immediately
3. **Trust Scores** - Adds spam protection
4. **NIP-43 Relay Auth** - Enables private relay support
5. **Custom Emojis** - Fun enhancement, lower priority
6. Others as needed

## References

- Upstream repo: https://github.com/CodyTseng/jumble
- Original merge plan was created but abandoned due to complexity
- This list created: 2025-12-02
