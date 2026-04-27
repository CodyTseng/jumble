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
    releaseType: 'release'
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
    target: [{ target: 'dmg', arch: ['arm64'] }],
    icon: 'public/pwa-512x512.png'
  },
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] }
    ],
    icon: 'public/pwa-512x512.png'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Network',
    icon: 'public/pwa-512x512.png'
  }
}
