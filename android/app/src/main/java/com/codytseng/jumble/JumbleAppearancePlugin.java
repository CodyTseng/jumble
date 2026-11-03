package com.codytseng.jumble;

import android.content.res.Configuration;
import android.graphics.Color;
import android.view.ViewTreeObserver;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JumbleAppearance")
public class JumbleAppearancePlugin extends Plugin {
    private Integer backgroundColor;
    private boolean dark;
    private boolean keyboardVisible;
    private float keyboardHeight;
    private final ViewTreeObserver.OnGlobalLayoutListener keyboardLayout = () -> {
        JSObject state = keyboardState();
        boolean visible = state.getBoolean("visible", false);
        float height = ((Number) state.opt("height")).floatValue();
        if (keyboardVisible == visible && keyboardHeight == height) return;
        keyboardVisible = visible;
        keyboardHeight = height;
        notifyListeners("keyboardVisibilityChanged", state);
    };

    @Override public void load() {
        getBridge().executeOnMainThread(() ->
            getBridge().getWebView().getViewTreeObserver().addOnGlobalLayoutListener(keyboardLayout));
    }

    @PluginMethod
    public void getKeyboardVisibility(PluginCall call) {
        getBridge().executeOnMainThread(() -> call.resolve(keyboardState()));
    }

    @SuppressWarnings("deprecation") // WebView scale converts physical insets into CSS pixels.
    private JSObject keyboardState() {
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getBridge().getWebView());
        boolean visible = insets != null && insets.isVisible(WindowInsetsCompat.Type.ime());
        // IME insets include the navigation bar. Only add back the extra space
        // taken by the keyboard, otherwise responsive height changes on dismissal.
        int covered = visible ? Math.max(0, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom -
            insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom) : 0;
        float scale = getBridge().getWebView().getScale();
        JSObject state = new JSObject();
        state.put("visible", visible); state.put("height", covered / scale);
        return state;
    }

    @Override protected void handleOnDestroy() {
        getBridge().getWebView().getViewTreeObserver().removeOnGlobalLayoutListener(keyboardLayout);
    }

    @PluginMethod
    public void setTheme(PluginCall call) {
        String color = call.getString("backgroundColor");
        Boolean isDark = call.getBoolean("dark");
        String setting = call.getString("themeSetting");
        if (color == null || !color.matches("#[0-9a-fA-F]{6}") || isDark == null ||
            setting == null || !setting.matches("light|dark|pure-black|system")) {
            call.reject("Expected an RGB background color and a dark theme flag");
            return;
        }
        getBridge().executeOnMainThread(() -> {
            backgroundColor = Color.parseColor(color);
            dark = isDark;
            NativeTheme.persist(getActivity(), setting);
            applyAppearance();
            call.resolve();
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        // Capacitor's SystemBars restores the OS theme on configuration changes.
        // Reapply the app's resolved theme after all native listeners have run.
        getBridge().executeOnMainThread(this::applyAppearance);
    }

    @Override
    protected void handleOnResume() {
        getBridge().executeOnMainThread(this::applyAppearance);
    }

    @PluginMethod
    public void ready(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            ((MainActivity) getActivity()).finishStartup();
            call.resolve();
        });
    }

    private void applyAppearance() {
        if (backgroundColor == null) return;
        NativeTheme.apply(getActivity(), backgroundColor, dark);
        getBridge().getWebView().setBackgroundColor(backgroundColor);
    }
}
