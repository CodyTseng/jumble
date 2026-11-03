import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.codytseng.jumble',
  appName: 'Jumble',
  webDir: 'dist-android',
  // Capacitor's debug bridge logging includes method arguments, including secret bundles.
  loggingBehavior: 'none',
  android: {
    // Capacitor's default discovery skips optionalDependencies.
    includePlugins: ['@capacitor/app', '@capacitor/local-notifications'],
    allowMixedContent: false
  },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_notification' },
    // Let Android inset the WebView; the shared UI also uses safe-area CSS.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'contain' }
  }
}

export default config
