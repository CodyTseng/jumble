package com.codytseng.jumble;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

public class RelayBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!context.getSharedPreferences("listener", 0).getBoolean("enabled", false) || !NotificationManagerCompat.from(context).areNotificationsEnabled()) return;
        try { ContextCompat.startForegroundService(context, new Intent(context, RelayNotificationsService.class)); }
        catch (RuntimeException restricted) { /* Resume when the user next opens Jumble. */ }
    }
}
