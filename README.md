# jumble

Yet another Nostr desktop client

## Features

- **Relay-Based Browsing:** Explore content directly through relays without following specific users. Discover diverse topics across different relays
- **Relay-Friendly Design:** Minimized and simplified requests ensure efficient communication with relays
- **Relay Groups:** Organize similar relays into custom groups for seamless switching between different content streams
- **Clean Interface:** Enjoy a minimalist design and intuitive interactions

## Download

You can download the latest version from the [release page](https://github.com/CodyTseng/jumble/releases). If you want to use Apple Silicon version, you need to build it from the source code.

Because the app is not signed, you may need to allow it to run in the system settings.

## Build from source

You can also build the app from the source code.

> Note: Node.js >= 20 is required.

```bash
# Clone this repository
git clone https://github.com/CodyTseng/jumble.git

# Go into the repository
cd jumble

# Install dependencies
npm install

# Build the app
npm run build:mac
# or npm run build:win
# or npm run build:linux
```

The executable file will be in the `dist` folder.

## Donate

If you like this project, you can buy me a coffee :) ⚡️ codytseng@getalby.com ⚡️

## License

MIT
