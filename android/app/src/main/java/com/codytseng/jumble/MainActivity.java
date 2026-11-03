package com.codytseng.jumble;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static volatile boolean visible;
    private boolean webContentReady;
    private JumbleWebChromeClient chrome;

    void finishStartup() {
        webContentReady = true;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(NativeTheme.getLaunchTheme(this));
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        long startedAt = SystemClock.elapsedRealtime();
        // A deadline also lets native/WebView errors surface if JS cannot signal readiness.
        splash.setKeepOnScreenCondition(() -> !webContentReady &&
            SystemClock.elapsedRealtime() - startedAt < 15_000);
        registerPlugin(JumbleStoragePlugin.class);
        registerPlugin(JumbleAppearancePlugin.class);
        registerPlugin(JumbleMediaPlugin.class);
        registerPlugin(JumbleFilesPlugin.class);
        registerPlugin(JumbleSystemPlugin.class);
        registerPlugin(JumbleBrowserAuthPlugin.class);
        registerPlugin(JumbleRelayNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        NativeTheme.apply(this, NativeTheme.getBackground(this), NativeTheme.isDark(this));
        // Disable Android's whole-WebView edge stretch, including fixed titlebars.
        if (bridge != null) {
            chrome = new JumbleWebChromeClient(bridge);
            bridge.getWebView().setWebChromeClient(chrome);
            bridge.getWebView().setWebViewClient(new JumbleWebViewClient(bridge));
            bridge.getWebView().setBackgroundColor(NativeTheme.getBackground(this));
            bridge.getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }
    @Override public void onResume() { super.onResume(); visible = true; }
    @Override public void onPause() { visible = false; super.onPause(); }
    @Override
    public void onDestroy() {
        if (chrome != null) chrome.onHideCustomView();
        super.onDestroy();
        if (RelayNotificationsService.instance != null) RelayNotificationsService.instance.resumeRuntime();
    }
}
