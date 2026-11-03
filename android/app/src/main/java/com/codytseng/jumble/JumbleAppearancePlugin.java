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
    private final ViewTreeObserver.OnGlobalLayoutListener keyboardLayout = () -> {
        boolean visible = isKeyboardVisible();
        if (keyboardVisible == visible) return;
        keyboardVisible = visible;
        JSObject state = new JSObject(); state.put("visible", visible);
        notifyListeners("keyboardVisibilityChanged", state);
    };

    @Override public void load() {
        getBridge().executeOnMainThread(() -> {
            keyboardVisible = isKeyboardVisible();
            getBridge().getWebView().getViewTreeObserver().addOnGlobalLayoutListener(keyboardLayout);
        });
    }

    @PluginMethod
    public void getKeyboardVisibility(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            JSObject state = new JSObject(); state.put("visible", isKeyboardVisible()); call.resolve(state);
        });
    }

    private boolean isKeyboardVisible() {
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getBridge().getWebView());
        return insets != null && insets.isVisible(WindowInsetsCompat.Type.ime());
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
