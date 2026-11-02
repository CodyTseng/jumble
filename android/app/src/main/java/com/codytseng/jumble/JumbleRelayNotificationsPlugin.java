package com.codytseng.jumble;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "JumbleRelayNotifications")
public class JumbleRelayNotificationsPlugin extends Plugin {
    @PluginMethod public void configure(PluginCall call) {
        JSObject config = call.getObject("config");
        if (config == null || !config.optString("pubkey").matches("[0-9a-f]{64}") || config.optJSONArray("relays") == null || config.toString().length() > 8 * 1024 * 1024) {
            call.reject("Invalid relay notification configuration"); return;
        }
        getBridge().execute(() -> {
            try {
                boolean stopped = getContext().getSharedPreferences("listener", 0).getBoolean("pausedByUser", false);
                if (stopped && !call.getBoolean("userInitiated", false)) { JSObject result = new JSObject(); result.put("running", false); call.resolve(result); return; }
                if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ||
                    (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)) {
                    call.reject("Notification permission was not granted"); return;
                }
                EncryptedStore storage = new EncryptedStore(getContext());
                String previous = storage.load("notifications");
                if (previous != null && !stopped && getContext().getSharedPreferences("listener", 0).getBoolean("enabled", false)) {
                    JSONObject old = new JSONObject(previous);
                    if (old.optString("pubkey").equals(config.optString("pubkey"))) config.put("enabledAt", old.optLong("enabledAt"));
                }
                storage.save("notifications", config.toString());
                getContext().getSharedPreferences("listener", 0).edit().putBoolean("enabled", true).putBoolean("pausedByUser", false).putString("lastError", "").apply();
                if (stopped || !config.toString().equals(previous) || RelayNotificationsService.instance == null) {
                    ContextCompat.startForegroundService(getContext(), new Intent(getContext(), RelayNotificationsService.class));
                }
                awaitStarted(call, android.os.SystemClock.elapsedRealtime());
            } catch (Exception error) { call.reject("Cannot start local relay notifications", error); }
        });
    }
    private void awaitStarted(PluginCall call, long began) {
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            String error = getContext().getSharedPreferences("listener", 0).getString("lastError", "");
            if (!error.isEmpty()) { call.reject(error); return; }
            RelayNotificationsService service = RelayNotificationsService.instance;
            if (service != null && service.started) {
                JSObject result = new JSObject(); result.put("running", true); call.resolve(result);
            } else if (android.os.SystemClock.elapsedRealtime() - began > 15_000) call.reject("Local relay listener did not start");
            else awaitStarted(call, began);
        }, 100);
    }
    @PluginMethod public void getStatus(PluginCall call) {
        JSObject status = new JSObject();
        RelayNotificationsService service = RelayNotificationsService.instance;
        status.put("running", service != null && service.started);
        status.put("error", getContext().getSharedPreferences("listener", 0).getString("lastError", ""));
        status.put("connections", service == null ? 0 : service.connected.get());
        status.put("subscriptions", service == null ? 0 : service.subscriptions.get());
        call.resolve(status);
    }
    @PluginMethod public void stop(PluginCall call) {
        getBridge().execute(() -> {
        getContext().getSharedPreferences("listener", 0).edit().putBoolean("enabled", false).apply();
        getContext().stopService(new Intent(getContext(), RelayNotificationsService.class));
        call.resolve();
        });
    }
}
