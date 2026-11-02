import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.codytseng.jumble',
  appName: 'Jumble',
  webDir: 'dist-android',
  // Capacitor's debug bridge logging includes method arguments, including secret bundles.
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false
  },
  plugins: {
    // Let Android inset the WebView; the shared UI also uses safe-area CSS.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'contain' }
  }
}

export default config
