package com.codytseng.jumble;

import android.content.res.Configuration;
import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JumbleAppearance")
public class JumbleAppearancePlugin extends Plugin {
    private Integer backgroundColor;
    private boolean dark;

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
