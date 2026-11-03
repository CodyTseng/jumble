package com.codytseng.jumble;

import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.webkit.WebChromeClient;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/** Keep Capacitor's permissions/file chooser, adding a real native fullscreen surface. */
final class JumbleWebChromeClient extends BridgeWebChromeClient {
    private final Bridge bridge;
    private final OnBackPressedCallback back;
    private FrameLayout fullscreen;
    private WebChromeClient.CustomViewCallback callback;
    private Bitmap defaultVideoPoster;
    private float scrollX;
    private float scrollY;
    private int fullscreenSession;

    JumbleWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
        back = new OnBackPressedCallback(false) {
            @Override public void handleOnBackPressed() { onHideCustomView(); }
        };
        bridge.getActivity().getOnBackPressedDispatcher().addCallback(bridge.getActivity(), back);
    }

    @Override
    public Bitmap getDefaultVideoPoster() {
        // WebView otherwise stretches its stock play-button artwork while no
        // poster/first frame is available. Keep the app's black video background.
        if (defaultVideoPoster == null) {
            defaultVideoPoster = Bitmap.createBitmap(16, 9, Bitmap.Config.ARGB_8888);
            defaultVideoPoster.eraseColor(Color.BLACK);
        }
        return defaultVideoPoster;
    }

    @Override
    @SuppressWarnings("deprecation") // WebView scale converts native scroll pixels to CSS pixels.
    public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) {
        if (fullscreen != null) { callback.onCustomViewHidden(); return; }
        this.callback = callback;
        float scale = bridge.getWebView().getScale();
        scrollX = bridge.getWebView().getScrollX() / scale;
        scrollY = bridge.getWebView().getScrollY() / scale;
        fullscreenSession++;
        fullscreen = new FrameLayout(bridge.getActivity());
        fullscreen.setTag("jumble-fullscreen");
        fullscreen.setFocusableInTouchMode(true);
        fullscreen.setBackgroundColor(Color.BLACK);
        fullscreen.addView(view, new FrameLayout.LayoutParams(-1, -1));
        ((ViewGroup) bridge.getActivity().getWindow().getDecorView()).addView(fullscreen, new ViewGroup.LayoutParams(-1, -1));
        bridge.getWebView().setVisibility(View.INVISIBLE);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(bridge.getActivity().getWindow(), fullscreen);
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        back.setEnabled(true);
        fullscreen.requestFocus();
    }

    @Override
    public void onHideCustomView() {
        if (fullscreen == null) return;
        ((ViewGroup) fullscreen.getParent()).removeView(fullscreen);
        fullscreen.removeAllViews();
        fullscreen = null;
        bridge.getWebView().setVisibility(View.VISIBLE);
        WindowCompat.getInsetsController(bridge.getActivity().getWindow(), bridge.getWebView()).show(WindowInsetsCompat.Type.systemBars());
        NativeTheme.apply(bridge.getActivity(), NativeTheme.getBackground(bridge.getActivity()), NativeTheme.isDark(bridge.getActivity()));
        back.setEnabled(false);
        WebChromeClient.CustomViewCallback previous = callback;
        callback = null;
        if (previous != null) previous.onCustomViewHidden();
        // Refocusing WebView can scroll Chromium's focused element into view.
        // Restore in the renderer after its fullscreen layout has finished;
        // View.scrollTo alone does not restore Chromium's document scroll offset.
        final int session = fullscreenSession;
        final float x = scrollX;
        final float y = scrollY;
        bridge.getWebView().post(() -> {
            if (fullscreen == null && fullscreenSession == session && !bridge.getActivity().isDestroyed()) {
                bridge.getWebView().evaluateJavascript(
                    "requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!document.fullscreenElement)window.scrollTo({left:"
                    + x + ",top:" + y + ",behavior:'instant'})}))", null);
            }
        });
    }
}
