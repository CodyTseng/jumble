<div align="center">
  <picture>
    <img src="./resources/logo-light.svg" alt="Jumble Logo" width="400" />
  </picture>
  <p>logo designed by <a href="http://wolfertdan.com/">Daniel David</a></p>
</div>

# Jumble

A user-friendly Nostr client for exploring relay feeds

Experience Jumble at [https://jumble.social](https://jumble.social)

## Forks

> Some interesting forks of Jumble.

- [https://fevela.me/](https://fevela.me/) - by [@daniele](https://jumble.social/users/npub10000003zmk89narqpczy4ff6rnuht2wu05na7kpnh3mak7z2tqzsv8vwqk)
- [https://x21.com/](https://x21.com/) - by [@Karnage](https://jumble.social/users/npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac)
- [https://jumble.imwald.eu/](https://jumble.imwald.eu/) Repo: [Silberengel/jumble](https://github.com/Silberengel/jumble) - by [@Silberengel](https://jumble.social/users/npub1l5sga6xg72phsz5422ykujprejwud075ggrr3z2hwyrfgr7eylqstegx9z)

## Run Locally

```bash
# Clone this repository
git clone https://github.com/CodyTseng/jumble.git

# Go into the repository
cd jumble

# Install dependencies
npm install

# Run the app
npm run dev
```

## Run Docker

```bash
# Clone this repository
git clone https://github.com/CodyTseng/jumble.git

# Go into the repository
cd jumble

# Run the docker compose
docker compose up --build -d
```

After finishing, access: http://localhost:8089

## Community mode (Optional)

If you want to run Jumble in community mode (with pre-configured relay sets and relays), you can set the following environment variables in a `.env` file at the root of the project:

- `VITE_COMMUNITY_RELAY_SETS`: Environment variable. Set the default relay sets for Jumble. Multiple relay sets can be configured. If configured, the first preset group will be displayed to visitors by default upon opening. Visitors cannot delete relay sets preset by administrators. This is ideal for communities wishing to host their own Jumble instances or for setting default feeds for family members. Examples:

```
VITE_COMMUNITY_RELAY_SETS=[{"id": "example.com", "name": "The Example Feed", "relayUrls": ["wss://relay.example.com/", "wss://relay.example.org/"]},{"id": "dailynews", "name": "News", "relayUrls": ["wss://news.example.com/", "wss://news.example.org/"]}]
```

- `VITE_COMMUNITY_RELAYS`: Environment variable. Set additional default relays for Jumble. Multiple relays can be configured, separated by commas. These relays will be added to the preset relay sets and cannot be removed by visitors. Examples:

```
VITE_COMMUNITY_RELAYS="wss://relay.example.com/,wss://relay.example.org/"
```

## Sponsors

<a target="_blank" href="https://opensats.org/">
  <img alt="open-sats-logo" src="./resources/open-sats-logo.svg" height="44"> 
</a>

## Donate

If you like this project, you can buy me a coffee :)

- **Lightning:** ⚡️ codytseng@getalby.com ⚡️
- **Bitcoin:** bc1qwp2uqjd2dy32qfe39kehnlgx3hyey0h502fvht
- **Geyser:** https://geyser.fund/project/jumble

## License

MIT
