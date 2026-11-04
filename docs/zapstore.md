# Publishing Jumble on Zapstore

Zapstore distributes the same signed APK as GitHub Releases. It does not use the
AAB. Keep the APK signing key stable across both distribution channels so Android
can update an installation regardless of which channel supplied the APK.

This guide targets **zsp v2.0.1**. The website's older v1 examples differ from v2:
`pubkey` and `assets` are ignored, `SIGN_WITH=browser` is not supported, and the
interactive wizard is started with `zsp`, without `publish --wizard`.
See the [v2 README](https://github.com/zapstore/zsp/blob/v2.0.1/README.md) and
[configuration/CLI specification](https://github.com/zapstore/zsp/blob/v2.0.1/SPEC.md).

## Publisher identity

Use this Nostr identity when creating the ownership proof and publishing:

```text
npub1syjmjy0dp62dhccq3g97fr87tngvpvzey08llyt6ul58m2zqpzps9wf6wl
```

Its hexadecimal public key is:

```text
8125b911ed0e94dbe3008a0be48cfe5cd0c0b05923cfff917ae7e87da8400883
```

The public key identifies the publisher but cannot sign anything. The actual
publishing identity comes from the configured Nostr signer and its NIP-C1
certificate ownership proof, not a `pubkey` field in `zapstore.yaml`.

## First release

1. Commit and push `zapstore.yaml`, then run the existing Release workflow for a
   release tag. It creates signed Android artifacts alongside the desktop builds.
2. Review and publish the GitHub Release draft. The APK must be a **public release
   asset**, named `Jumble-android.apk`; a workflow artifact or a draft
   release is not a public download source.
3. Install `zsp` from its [official releases](https://github.com/zapstore/zsp/releases/tag/v2.0.1),
   or build the pinned version with Go:

   ```sh
   go install github.com/zapstore/zsp/v2/cmd/zsp@v2.0.1
   ```

4. From this repository's root, run the interactive wizard yourself:

   ```sh
   zsp
   ```

5. Follow the wizard to link the APK signing certificate to the Nostr identity
   above. Use the same `.p12` keystore configured in the Android release Secrets.
   Enter its password locally when prompted. The wizard verifies that the key
   matches the published APK and establishes the NIP-C1 proof.
6. Use the signer for the stated Nostr identity. A NIP-46 remote signer
   (`bunker://`) is recommended. If the wizard offers to save signer credentials
   to `.env`, keep that file private; it is already excluded by `.gitignore`.
   Do not place a keystore, password, private key, or bunker connection secret in
   `zapstore.yaml` or Git.
7. Confirm the app metadata and publication in the wizard. If it reports that
   publication is pending, allow the relay's checks to complete before retrying.

`zapstore.yaml` selects only the Android APK from the mixed-platform Release and
uses the existing 512px app icon. It supplies the listing name, summary, license,
website and tags. App screenshots can be added later with the v2 `images` field.
Package ID, version, version code and signing certificate are read from the APK.

## Subsequent releases

Once the ownership proof and Nostr signer are configured:

```sh
# Read-only verification; does not sign, upload, or publish.
zsp check zapstore.yaml

# Publish the latest public APK using the configured signer.
zsp publish zapstore.yaml
```

`SIGN_WITH` must refer to the authorized signer. Prefer a remote signer or a
properly delegated publishing identity if automating later. The current GitHub
workflow only builds/signs Android artifacts; it does not publish Nostr catalog
events. Initial ownership linking and signer authorization happen locally.

The Android `versionCode` is maintained in `android/app/build.gradle` and shared
by local and CI builds. Increment it before each new release; new APKs must have
a version code greater than every previously distributed version.

If Play App Signing is enabled later, check its actual distribution certificate
before offering updates across Play, GitHub and Zapstore: an upload key can be
different from the key Google uses to sign delivered APKs.
