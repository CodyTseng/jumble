import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Only explicitly supplied signing certificates are published. Never trust a debug key by default.
const fingerprints = (process.env.ANDROID_APP_LINKS_SHA256 ?? '')
  .split(',')
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean)
if (
  !fingerprints.length ||
  fingerprints.some((value) => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value))
) {
  console.error(
    'Set ANDROID_APP_LINKS_SHA256 to the SHA-256 certificate fingerprint(s) from Play App Signing, separated by commas.'
  )
  process.exitCode = 1
} else {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const output = path.resolve(root, process.argv[2] ?? 'public/.well-known/assetlinks.json')
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileSync(
    output,
    JSON.stringify(
      [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'com.codytseng.jumble',
            sha256_cert_fingerprints: fingerprints
          }
        }
      ],
      null,
      2
    ) + '\n'
  )
  console.log(`Generated ${output}; deploy it at https://jumble.social/.well-known/assetlinks.json`)
}
