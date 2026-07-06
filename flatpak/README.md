# Flatpak packaging

Jumble can be built as a Flatpak with the same app id as the Electron package:
`com.codytseng.jumble`.

Flatpak builds are architecture-specific. The same manifest can be built for
`x86_64` and `aarch64`; a Flatpak repository such as Flathub publishes both
architectures under the same app id, and users install the build matching their
device.

## Prerequisites

- `flatpak`
- `flatpak-builder`
- `flatpak-node-generator`
- The Flathub remote

Install the runtime pieces once:

```bash
flatpak install flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08 org.electronjs.Electron2.BaseApp//25.08 org.freedesktop.Sdk.Extension.node24//25.08
```

Install the node source generator:

```bash
pipx install 'git+https://github.com/flatpak/flatpak-builder-tools.git#subdirectory=node'
```

## Build locally

Generate the offline npm source list, then build:

```bash
npm run flatpak:generate-sources
npm run flatpak:build
```

Create a single-file bundle:

```bash
mkdir -p release/flatpak
flatpak build-bundle flatpak/repo release/flatpak/Jumble-linux-$(flatpak --default-arch).flatpak com.codytseng.jumble --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo
```

Run the app:

```bash
flatpak run com.codytseng.jumble
```

## Flathub

Before submitting to Flathub, commit a freshly generated
`flatpak/generated-sources.json` for the exact `package-lock.json` in the
release branch. Flathub will build each supported architecture separately from
the same manifest.
