package com.codytseng.jumble;

import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.graphics.Color;
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

    JumbleWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
        back = new OnBackPressedCallback(false) {
            @Override public void handleOnBackPressed() { onHideCustomView(); }
        };
        bridge.getActivity().getOnBackPressedDispatcher().addCallback(bridge.getActivity(), back);
    }

    @Override
    public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) {
        if (fullscreen != null) { callback.onCustomViewHidden(); return; }
        this.callback = callback;
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
        bridge.getWebView().requestFocus();
        WindowCompat.getInsetsController(bridge.getActivity().getWindow(), bridge.getWebView()).show(WindowInsetsCompat.Type.systemBars());
        NativeTheme.apply(bridge.getActivity(), NativeTheme.getBackground(bridge.getActivity()), NativeTheme.isDark(bridge.getActivity()));
        back.setEnabled(false);
        WebChromeClient.CustomViewCallback previous = callback;
        callback = null;
        if (previous != null) previous.onCustomViewHidden();
    }
}
