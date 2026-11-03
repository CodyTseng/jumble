# Android

Jumble's Android app packages the same React/Vite UI using Capacitor. Web and
Electron builds keep their existing entry points. Android assets are bundled
inside the APK; production does not load a hosted website.

## Requirements

- The project's Node.js version (`npm install`).
- Android Studio, Android SDK 36, and JDK 21 (Android Studio's bundled JBR works).
- The `android:run`, `android:apk`, and `android:bundle` scripts select JDK 21
  automatically from `JAVA_HOME`, PATH, registered macOS JDKs, Homebrew's
  `openjdk@21` at its default macOS location, or Android Studio's
  bundled JBR at its default installation location. Set `ANDROID_JAVA_HOME` to
  override discovery. They also discover the default Android SDK location.
- For direct `./gradlew` commands, set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to
  your SDK directory, or configure `android/local.properties` with `sdk.dir=...`
  (this file is ignored). Android Studio builds use its Gradle JDK setting.

On macOS, install JDK 21 with Homebrew if it is missing (or if Android Studio
bundles a newer JBR version):

```sh
brew install openjdk@21
```

The Android scripts discover this installation automatically, without changing
your global `JAVA_HOME`.

To use Android Studio's bundled JDK in the current terminal, if it is version 21:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

## Build and run

If optional dependencies were skipped, restore them before building Android:

```sh
npm install --include=optional
```

The `@capacitor/*` packages are only required for Android. Its build uses separate
TypeScript configurations to check against the real plugins; web and Electron
builds do not need them installed.

`capacitor.config.ts` explicitly lists the Android plugins in `android.includePlugins`
because Capacitor's default discovery does not scan `optionalDependencies`. Add new
Capacitor plugins to that list so syncing includes their native implementations.

```sh
npm run android:open     # Open the native project in Android Studio
npm run android:run      # Build/sync the UI, then choose an emulator or device
npm run android:apk      # Produce a debug APK
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk`.
`npm run android:build` builds the UI into `dist-android/` and syncs Capacitor's
assets and plugins; it does not compile an APK. After changing Web code or
plugins, run it before building in Android Studio. `android:sync` only copies
already-built assets and updates native plugin configuration.

## Architecture

- `capacitor.config.ts`: application ID `com.codytseng.jumble`, local assets,
  system-bar inset configuration. Bridge payload logging is disabled to keep
  secret bundles out of logcat. Android uses a contained viewport so shared
  safe-area CSS and native insets do not apply padding twice.
- `vite.android.config.ts`: shared Vite configuration, separate output directory,
  no PWA service worker, Android viewport transform.
- `src/lib/platform.ts`: runtime detection, independent of screen size.
- `src/types/native-storage.ts` / `src/lib/native-storage.ts`: shared storage
  contracts and capability selection. Electron's IPC contract re-exports these
  types and keeps its existing bridge.
- `src/lib/native-local-storage.ts`: encrypted native snapshot recovery before
  application modules read localStorage; sanitized snapshots and serialized
  backup writes. The revision key retains its original Electron name for
  compatibility with desktop snapshots.
- `LocalStorageService`: synchronous getters backed by in-memory secret maps;
  one asynchronous boot hydration, serialized native persistence. Native secret
  fields never serialize into localStorage.
- `android/.../EncryptedStore.java`: AES-256-GCM with an Android Keystore key,
  fresh nonces, authenticated store names, and atomic file replacement. Both
  secrets and preferences snapshots live under `noBackupFilesDir`; OS backup
  and device transfer are disabled. A missing key or decryption failure does
  not replace existing data. Android boot stops if encrypted storage cannot be
  opened.
- `MainActivity.java`: disables native WebView overscroll stretching so reaching
  a list boundary does not distort the page or its fixed titlebars.
- `use-native-navigation.ts`: Android back closes the top modal, then navigates
  the existing secondary-page history, then minimizes at the primary page.
  `nostr:` public identifiers work on cold and warm launches. Private-key URIs
  are deliberately not handled as navigation.
- `native-appearance.ts`: synchronizes the native window background and system
  bar icons with the resolved light, dark, or pure-black app theme. Navigation
  bar contrast scrims are disabled so the inset areas match the app background.
  A non-secret native preference mirrors the theme setting for startup. On
  Android 12+, the OS also persists the selected splash theme before the next
  process starts, including separate light/dark/pure-black themes and night
  resources for system mode. Keep these resource names stable across releases.
- `MainActivity` keeps the AndroidX splash screen visible until React has applied
  its initial theme and can paint. A 15-second deadline and the JS error path
  prevent a failed startup from leaving the splash up indefinitely.
- `drawable-xxxhdpi/splash_mark.png` uses the original 1038×1179 transparent
  logo embedded in `resources/icon.svg`, placed on a 1152px canvas with Android's
  safe-area padding and a compact 96dp-wide mark. It avoids upscaling a launcher
  thumbnail or clipping the mark. Dark and pure-black themes use #999999 rather
  than white to reduce nighttime glare; the background still matches the theme.
- `native-lifecycle.ts`: flushes preference snapshots on backgrounding and asks
  the existing SmartPool lifecycle to check connections on resuming. Relay
  WebSockets and signing remain in the WebView.
- `proxy-fetch.ts`: existing proxy consumers use Capacitor native HTTP on Android;
  global fetch, uploads, and WebSocket transports are not monkey-patched.
- `native-image.ts` / `JumbleMediaPlugin`: image saving streams remote files via
  Android HTTP and writes original bytes into `Pictures/Jumble` using MediaStore.
  Local/blob images use the same gallery writer. Android 10+ needs no media-read
  or storage permission; Android 7–9 requests legacy write permission when saving.
  Failed downloads and writes remove temporary/pending files; the UI reports
  progress, success, and failure instead of relying on WebView anchor downloads.
- `ic_notification`: a transparent, single-color Jumble mark sized for Android
  status bars, used by the listener, activity alerts, and local notifications.
- `system-notification/native.ts`: local notifications for events received while
  the process is active, using the existing notification service interface.

Do not import Node APIs into renderer code or copy Electron's Node relay
transport into Android. Add platform capabilities at the adapter boundaries.

## Permissions and Google Play declarations

Audit the **merged release manifest**, including dependency permissions, before
uploading an APK/AAB. The current permission set is:

| Permission                                                | Purpose                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `INTERNET`                                                | Relay connections, media and application HTTP requests.                                                              |
| `ACCESS_NETWORK_STATE`                                    | The local listener observes connectivity changes to reconnect relays.                                                |
| `POST_NOTIFICATIONS`                                      | User-authorized system notifications on Android 13+.                                                                 |
| `CAMERA`                                                  | QR-code scanning and camera access through WebView; requested when used.                                             |
| `WRITE_EXTERNAL_STORAGE` (max SDK 28)                     | Save images to Pictures/Jumble on Android 7–9; newer Android uses MediaStore without this permission.                |
| `RECEIVE_BOOT_COMPLETED`                                  | Restore background listening after reboot only when the user previously enabled it and notifications remain allowed. |
| `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE` | The user-enabled local relay listener and its ongoing, stoppable notification.                                       |
| App-scoped `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`     | AndroidX-generated signature permission protecting internal receivers; not a user permission prompt.                 |

The local-notifications dependency declares `SCHEDULE_EXACT_ALARM` and
`WAKE_LOCK`, but Jumble does not schedule timed notifications or acquire wake
locks. Manifest-merger removal rules exclude both from the application. Immediate
notifications use NotificationManager directly. No broad photo/video access,
all-files access, microphone, location, contacts, SMS, package-installation or
battery-optimization exemption permission is declared. Media selection/export
uses system pickers; opening battery settings does not request an exemption.

Google Play requires a foreground-service declaration for the Android 14+
`specialUse` service. Prepare an accurate description of user-initiated local
Nostr notification listening, what users lose if it is delayed/interrupted, and
a demonstration video showing activation, the ongoing notification and the Stop
action. Also explain restoration after reboot. The manifest's subtype description
does not replace the Play Console declaration. Acceptance of this background
listening use case remains subject to Google's review; do not relabel the service
as another type merely to avoid that review.

Keep the privacy policy and Data safety answers consistent with actual camera,
media upload and network behavior. These disclosures are separate from the
restricted-permission/foreground-service declaration forms.

References: [foreground-service declaration requirements](https://support.google.com/googleplay/android-developer/answer/13392821),
[special-use service requirements](https://developer.android.com/develop/background-work/services/fgs/service-types#special-use),
and [photo/video permission policy](https://support.google.com/googleplay/android-developer/answer/16558241).

## Release builds

The Android `versionName` comes from `package.json`. Increment the Play version
code for each upload:

```sh
npm run android:build
cd android
./gradlew bundleRelease -PandroidVersionCode=2
```

Without signing environment variables, local release builds remain **unsigned**.
Configure an upload key in Android Studio's **Generate Signed Bundle / APK**, or
set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD` when running Gradle. Never commit keys or passwords.

The `Release` GitHub Actions workflow also builds a signed release APK and AAB on
Ubuntu with JDK 21 and Android SDK 36. Configure these repository Actions secrets
before running it:

| Secret                      | Value                                |
| --------------------------- | ------------------------------------ |
| `ANDROID_KEYSTORE_BASE64`   | Base64-encoded release keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password                    |
| `ANDROID_KEY_ALIAS`         | Signing key alias                    |
| `ANDROID_KEY_PASSWORD`      | Signing key password                 |

Use the same signing key for subsequent Jumble APK releases so installed apps can
update. A separate keystore for Jumble is recommended; an existing signing key or
a new alias in an existing keystore also works. For example, generate a dedicated
key with the JDK's `keytool` (it prompts for passwords):

```sh
keytool -genkeypair -v -keystore jumble-release.jks -alias jumble \
  -keyalg RSA -keysize 3072 -validity 10000
```

Store the keystore and credentials in a durable backup outside the repository.
Encode the file as Base64 for the secret, without uploading it as an artifact.
The workflow restores it under the runner's temporary directory and deletes it
in an `always()` cleanup step. Missing signing secrets fail the Android job;
unsigned or debug-signed artifacts are never silently published.

The workflow uses `package.json` for `versionName` and its `github.run_number` for
`versionCode`. Its first version code must exceed any Android builds already
distributed; later codes increase with workflow runs, and reruns retain the same
code. Before adopting this workflow for an existing distribution, compare that
initial run number with the highest version code already released.

Artifacts are named `Jumble-android.apk` and
`Jumble-android.aab`. Tag builds attach both to the same GitHub Release
draft as desktop/Flatpak artifacts. Manual runs make them available as workflow
artifacts without publishing a Release. Android source maps are archived
separately. The Release job waits for Android, desktop and Flatpak builds.

Stable download URLs, once the Release is published:

- APK: `https://github.com/CodyTseng/jumble/releases/latest/download/Jumble-android.apk`
- AAB: `https://github.com/CodyTseng/jumble/releases/latest/download/Jumble-android.aab`

For publishing the same signed APK on Zapstore, see [the Zapstore release guide](zapstore.md).

`npm run android:bundle` still defaults to version code 1 unless overridden.
Store metadata, privacy disclosures, UGC moderation review, and payment-policy
review remain separate from the artifact build.

## Validation

```sh
npm test
npm run lint
npm run android:build
cd android
./gradlew :app:assembleDebug :app:lintDebug
./gradlew :app:connectedDebugAndroidTest
```

Instrumentation tests use an isolated test directory, not the application's
account files. They check real Keystore encryption, reopening, fresh nonces,
tamper rejection, and isolation between the secrets/state stores. To select a
single emulator when other devices are connected, set `ANDROID_SERIAL`.

## Initial scope and remaining work

Direct messages are unavailable on Android. A platform capability forces the
preference off even when existing/imported storage says it is enabled; the enable
switch, navigation/profile entry points, DM routes, and service initialization
are disabled. Web and Electron retain their existing DM behavior.

This is the Android integration foundation. Test login, editing, media uploads,
video playback, keyboard behavior, RTL, and suspend/resume on physical devices
before distribution. NIP-07 browser extensions are not available inside the
WebView; use the existing in-app key or bunker login flows. Android external
signer integration (NIP-55) is not implemented yet.

Google login, binding, disconnect and operator recovery use the system browser's
Custom Tabs; the app does not need registration in the shared central's Google
Cloud project. Partial Custom Tabs open at 70% of the current window height when
the browser supports them; unsupported browsers may use a full-screen tab. Google
popups opened by the authorization page may also use a full-screen browser tab.
Android and Electron share `pomegranate-browser-page.ts`; existing TypeScript
handles account creation, token checks, shard checks and signing.
`JumbleBrowserAuthPlugin` only serves a temporary authorization relay on
`127.0.0.1` and receives a same-origin result. Each request has a random path,
literal Host/Origin checks, a restrictive CSP, no caching and a five-minute
expiry. Closing the browser cancels the request. Successful authorization closes the
OAuth popup, then the native host dismisses the Custom Tab and resumes the same
app Activity automatically, without a completion page or return button. No token
or key shard travels through an Intent or deep link. Results remain in memory;
Activity/process destruction interrupts authorization and the user retries.
An installed browser is required. The Pomegranate central server and operators
use their existing popup/postMessage authentication protocol; no new server
callback endpoint or Google native SDK is required.

Background notifications are local: enabling system notifications starts a
native foreground service with an ongoing notification and a Stop action. The
service owns an independent, non-visual WebView; closing the Activity does not
destroy that JS environment. The bundled TypeScript uses the same `SmartPool`,
`nostr-verifier`, `notificationFilter`, and `NotificationProcessor` as the app.
Zap validation and trust-score rules are shared modules too. Java only hosts the
runtime and bridges generic WebSocket/HTTPS transport, encrypted cursor storage,
network state, and Android notifications. No Nostr event/signature/filter logic
is reimplemented in Java. Configuration and event cursors are encrypted. There
is no FCM token, push gateway, or external notification server. A recent replay
window recovers short disconnections without flooding the user with old alerts.

Android Doze, network availability, and vendor battery policies can delay local
relay traffic; Settings → Notifications → Battery settings opens the OS controls.
Force-stopping the app prevents listeners from restarting until the app is opened
again. Otherwise an enabled listener can restart after a normal process restart
or device reboot. Background subscriptions currently require publicly readable relays. AUTH-only
relays use the foreground app/signing connection; public fallback relays are also
monitored. The `specialUse` foreground-service type must
be declared and explained during a future Play submission.

Cleartext HTTP/WS endpoints are not enabled by the Android app's network policy.

## Native capability checks

- Text/key exports use Android's Save As document picker. They write directly to
  the selected URI and report success after the stream closes; cancellation is
  preserved. Private-key exports never pass through plaintext cache files.
- Clipboard writes use Android ClipboardManager, with previews marked sensitive.
  External wallet/signer links show feedback if no matching app is installed.
  Android's wallet selector offers NWC instead of browser-extension connectors.
- Camera scanning uses Capacitor's runtime camera permission handler; the camera
  is optional hardware. File/image upload inputs retain the native file picker.
- Video fullscreen uses a dedicated native surface; Android Back exits fullscreen
  before affecting the app's page history, and the normal theme/insets return.
- Audio retains its existing WebView player. Native lock-screen/background media
  playback is intentionally not enabled.

Native instrumentation tests cover successful/cancelled document exports, selected
image bytes, a live camera stream, clipboard privacy flags, entering/leaving
fullscreen, MediaStore writes and
shared JS signature/notification filtering, and background processing after the
Activity is destroyed. These tests use test files and public
protocol fixtures, not real private keys or payments. Run them on a test emulator.

## HTTPS App Links

The Android manifest and link router accept public `jumble.social` note/profile/
relay URLs and root-page query links. `nostr:` public identifiers remain supported;
DM, credential-bearing, and unrelated-host URLs are rejected.

`public/.well-known/assetlinks.json` contains the production signing certificate
fingerprint for directly distributed APKs. Deploy it with the web build at
`https://jumble.social/.well-known/assetlinks.json`. Verified App Links require
that this fingerprint matches the certificate on the installed APK. The existing
`nostr:` scheme remains available independently of HTTPS verification.

Use the SHA-256 certificate fingerprint of the distributed APK. With Play App
Signing, use the **app signing** certificate from Play, not just the upload key:

```sh
ANDROID_APP_LINKS_SHA256='AA:BB:...:FF' npm run android:app-links
```

Multiple production certificate fingerprints can be comma-separated during a
signing transition. Do not include debug certificates in the production association.
No certificate private keys are placed in this repository. After deploying:

```sh
adb shell pm verify-app-links --re-verify com.codytseng.jumble
adb shell pm get-app-links com.codytseng.jumble
```

## Shared background runtime

`background/index.html` is a second input of the Android Vite build. Its entry
`src/background/index.ts` loads the transport-independent runner. The main web
and Electron builds do not include this service entry.

- `event-core.ts`, `zap-info.ts`, `lightning-invoice.ts`: existing helpers extracted
  without ClientService/browser-storage initialization. Legacy imports re-export
  them, so the foreground app keeps the same behavior.
- `notification-processor.ts`: one signed-event filtering/deduplication pipeline,
  used by NotificationProvider and the service runner. Runtime-specific adapters
  supply preferences, delivery, and cursor persistence.
- `notification.ts`, `zap-validation.ts`, `trust-score.ts`: shared kinds,
  classification, mute/target filtering, receipt checks, and trust policy.
- `background/runner.ts`: subscribes using the existing SmartPool and verifier;
  retains logical subscriptions and delegates retries/health checks to the pool.
- `background/websocket.ts`: browser-compatible socket adapter for native network
  I/O. Java handles raw frames, never Nostr messages.
- `RelayNotificationsService`: owns the background WebView using application
  context. Only packaged assets are served from its secure origin; navigation,
  content/file access, remote scripts, frames, and DOM storage are disabled.
  Epoch checks prevent stale callbacks from crossing runtime/account changes.

The background entry deliberately has no React, ClientService, signing-key, or
localStorage initialization. Its platform bridge never receives identity secrets.
A renderer failure restarts the independent runtime and restores its encrypted
cursor; ordinary Activity destruction leaves it running. As with all local
Android listeners, Doze/battery restrictions can still defer network traffic.
