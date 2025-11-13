<div align="center">
  <picture>
    <img src="./resources/logo-light.svg" alt="Seewaan Logo" width="400" />
  </picture>
  <p>logo designed by <a href="http://wolfertdan.com/">Daniel David</a></p>
</div>

# Seewaan

A feature-rich Nostr client with domain-based community discovery

**Seewaan** (صيوان - a campsite where Bedouins meet) is an enhanced fork of [Jumble](https://github.com/CodyTseng/jumble) by [@codytseng](https://github.com/CodyTseng), focused on bringing community features and improved user experience to the Nostr ecosystem.

## What Makes Seewaan Different

### NIP-05 Communities
Discover and engage with communities based on verified NIP-05 domains. Seewaan treats verified domains (like @nostr.build, @stacker.news) as natural community boundaries, enabling:
- **Domain-based feeds**: Browse activity from users verified under specific domains
- **Community profiles**: Explore trending domains, member counts, and community activity
- **Favorite domains**: Follow and track your favorite communities
- **Domain discovery**: Find communities through your following network and trending lists

### Enhanced Explore Experience
- **Community Profiles**: Browse verified domain communities with detailed stats
- **Following's Domains**: Discover which domains your network uses
- **Community Sets**: Organize and group related communities
- **Smart search**: Find communities, users, and content across the network

### Multi-Language Support
Full internationalization with support for:
- English
- Arabic (العربية) with RTL support
- Extensible framework for additional languages

### Relay-First Navigation
Like the original Jumble, Seewaan maintains the unique relay-first approach:
- Browse individual relay feeds without logging in
- Switch seamlessly between relay, multi-relay, and following feeds
- Explore the network before committing to an account

## Features

- 🔐 **Multiple Authentication Methods**: nsec, NIP-07 extensions, Nostr Connect (NIP-46), nip46:// URLs
- 🌐 **Multi-Account Support**: Switch between multiple Nostr identities
- 📡 **Flexible Feed System**: Relay feeds, following feeds, and domain community feeds
- 🔍 **Advanced Search**: Profile search with FlexSearch, relay discovery
- 💬 **Rich Content**: Text notes, images, videos, polls, quotes, reposts
- ⚡ **Lightning Zaps**: Send and receive Bitcoin tips via Lightning
- 🔖 **Lists & Organization**: Bookmarks, pins, mute lists, relay sets
- 🎨 **Customizable UI**: Light/dark/pure-black themes, responsive layout
- 📱 **Mobile-Friendly**: Full mobile support with bottom navigation
- 🔒 **Privacy-Focused**: Encrypted mute lists (NIP-59), local-first data
- 🌍 **Community Discovery**: NIP-05 domain-based communities
- 🌐 **Internationalization**: Multi-language support with automatic detection

## Run Locally

```bash
# Clone this repository
git clone https://github.com/tkhumush/Seewaan.git

# Go into the repository
cd Seewaan

# Install dependencies
npm install

# Run the app
npm run dev
```

## Run with Docker

```bash
# Clone this repository
git clone https://github.com/tkhumush/Seewaan.git

# Go into the repository
cd Seewaan

# Run the docker compose
docker compose up --build -d
```

After building, access the app at: http://localhost:8089

## Technology Stack

- **Framework**: React 18 with TypeScript
- **State Management**: React Context API (no Redux/Zustand)
- **Nostr Protocol**: nostr-tools v2
- **UI Components**: Radix UI + Tailwind CSS
- **Storage**: IndexedDB for offline-first persistence
- **Search**: FlexSearch for fast profile lookup
- **Rich Text**: TipTap editor with autocomplete
- **Lightning**: LNURL-pay integration for zaps

## Architecture Highlights

Seewaan uses a sophisticated provider-based architecture:
- **23 React Context Providers** managing authentication, feeds, user data, and UI state
- **18+ Singleton Services** handling Nostr protocol, caching, and external integrations
- **Relay Pool Management** with intelligent multi-relay deduplication
- **IndexedDB Persistence** for offline-capable experience
- **DataLoader Pattern** for efficient event batching

For detailed architecture documentation, see [CLAUDE.md](./CLAUDE.md).

## Credits

### Original Project
**Jumble** created by [@codytseng](https://github.com/CodyTseng)
- Repository: [github.com/CodyTseng/jumble](https://github.com/CodyTseng/jumble)
- Live site: [jumble.social](https://jumble.social)

### Other Jumble Forks
Notable forks of the original Jumble project:
- [jumblekat.com](https://jumblekat.com/) - by [@Karnage](https://jumble.social/users/npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac)
- [grouped-notes.dtonon.com](https://grouped-notes.dtonon.com/) - by [@daniele](https://jumble.social/users/npub10000003zmk89narqpczy4ff6rnuht2wu05na7kpnh3mak7z2tqzsv8vwqk)
- [jumble.imwald.eu](https://jumble.imwald.eu/) - [Silberengel/jumble](https://github.com/Silberengel/jumble) by [@Silberengel](https://jumble.social/users/npub1l5sga6xg72phsz5422ykujprejwud075ggrr3z2hwyrfgr7eylqstegx9z)

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

MIT License - see [LICENSE](./LICENSE) for details.

This project is a fork of Jumble, originally created by [@codytseng](https://github.com/CodyTseng) under the MIT License.
