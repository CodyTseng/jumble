# Dependency maintenance

Install script policy is recorded in `package.json` under `allowScripts`:

- `electron@45.2.1`: allowed to download and extract Electron with bundled checksums.
- `electron-winstaller`: denied; our Windows target is NSIS, not Squirrel.
- `fsevents`: denied; version 2.3.3 ships a prebuilt `fsevents.node` and does not
  need an installation build.

Review scripts again when upgrading an allowed version. Use
`npm install-scripts ls` to check pending decisions; do not approve all packages.
Use `npm ci` to reproduce the lockfile. npm versions predating this policy may
not enforce it, so a clean script list alone does not prove enforcement.

The schema tests use published JSON fixtures instead of installing schemata's
unused generator dependencies. This also removes esbuild, so it requires no
install-script approval. See the fixture README for provenance and updates.

## Remaining upstream work

`@getalby/bitcoin-connect@3.12.3` depends on `@lightninglabs/lnc-web`, which uses
the discontinued `crypto-js@4.2.0`. The newer `lnc-web@0.4.0-alpha` still declares
CryptoJS, so forcing it would not remove this dependency. Follow a compatible
upstream migration; replacing encryption APIs locally requires checking wallet
interoperability and stored credential compatibility. Do not substitute Web
Crypto through a package override.

Audit findings still exist in the Electron packaging and Workbox build tools.
Review their actual vulnerable code paths and upstream fixes. Do not run
`npm audit fix --force`: its suggested solutions include downgrading
electron-builder to 22 and vite-plugin-pwa to 0.2. A zero production audit count
does not cover discontinued packages or establish supply-chain safety.
