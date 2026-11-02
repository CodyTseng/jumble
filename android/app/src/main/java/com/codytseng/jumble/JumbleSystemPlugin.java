package com.codytseng.jumble;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PersistableBundle;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JumbleSystem")
public class JumbleSystemPlugin extends Plugin {
    @PluginMethod
    public void writeClipboard(PluginCall call) {
        String text = call.getString("text");
        if (text == null) { call.reject("Missing clipboard text"); return; }
        getBridge().executeOnMainThread(() -> {
            ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData data = ClipData.newPlainText("Jumble", text);
            PersistableBundle extras = new PersistableBundle();
            // Suppress OS clipboard previews, including when copying private keys or API credentials.
            extras.putBoolean("android.content.extra.IS_SENSITIVE", true);
            data.getDescription().setExtras(extras);
            try {
                clipboard.setPrimaryClip(data);
                call.resolve();
            } catch (RuntimeException error) { call.reject("Cannot copy to clipboard", error); }
        });
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                getActivity().startActivity(new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                call.resolve();
            } catch (android.content.ActivityNotFoundException missing) {
                try {
                    getActivity().startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getContext().getPackageName())));
                    call.resolve();
                } catch (RuntimeException unavailable) { call.reject("Cannot open battery settings", unavailable); }
            }
        });
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String value = call.getString("url", "");
        Uri uri = Uri.parse(value);
        String scheme = uri.getScheme();
        if (scheme == null || !scheme.matches("https?|mailto|tel|lightning|bitcoin|nostr|nostrconnect|nostrsigner")) {
            call.reject("Unsupported external link"); return;
        }
        getBridge().executeOnMainThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
                call.resolve();
            } catch (android.content.ActivityNotFoundException error) {
                call.reject("No app is installed to open this link");
            } catch (RuntimeException error) { call.reject("Unable to open this link", error); }
        });
    }
}
