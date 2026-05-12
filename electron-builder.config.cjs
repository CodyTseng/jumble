require('dotenv').config({ path: 'electron-builder.env' })

const hasAppleNotarizeCreds = !!process.env.APPLE_ID
const hasMacSigningCert = !!process.env.CSC_LINK || hasAppleNotarizeCreds

module.exports = {
  appId: 'com.codytseng.jumble',
  productName: 'Jumble',
  copyright: 'Copyright © ${author}',
  directories: {
    output: 'release/${version}',
    buildResources: 'build'
  },
  publish: {
    provider: 'github',
    owner: 'CodyTseng',
    repo: 'jumble',
    releaseType: 'draft'
  },
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'package.json',
    '!node_modules/**/*',
    'node_modules/ws/**/*'
  ],
  asar: true,
  mac: {
    category: 'public.app-category.social-networking',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    identity: hasMacSigningCert ? 'Developer ID Application' : null,
    notarize: hasAppleNotarizeCreds,
    target: [
      { target: 'dmg', arch: ['arm64'] },
      { target: 'zip', arch: ['arm64'] }
    ],
    artifactName: 'Jumble-mac-${arch}.${ext}',
    icon: 'public/pwa-512x512.png'
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: 'Jumble-windows-${arch}.${ext}',
    icon: 'public/pwa-512x512.png'
  },
  nsis: {
    oneClick: true,
    perMachine: false
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Network',
    artifactName: 'Jumble-linux-${arch}.${ext}',
    icon: 'public/pwa-512x512.png'
  }
}
