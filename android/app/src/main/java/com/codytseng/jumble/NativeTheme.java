package com.codytseng.jumble;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** Small non-secret theme mirror available before the encrypted WebView state is loaded. */
final class NativeTheme {
    private static final String PREFERENCES = "appearance";
    private static final String SETTING = "themeSetting";

    static String getSetting(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(SETTING, "system");
    }

    static boolean isDark(Context context) {
        String setting = getSetting(context);
        return setting.equals("dark") || setting.equals("pure-black") ||
            (setting.equals("system") && (context.getResources().getConfiguration().uiMode &
                Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
    }

    static int getBackground(Context context) {
        if (getSetting(context).equals("pure-black")) return Color.BLACK;
        return isDark(context) ? Color.rgb(23, 23, 23) : Color.WHITE;
    }

    static int getLaunchTheme(Context context) {
        return launchTheme(getSetting(context));
    }

    private static int launchTheme(String setting) {
        return switch (setting) {
            case "light" -> R.style.AppTheme_NoActionBarLaunch_Light;
            case "dark" -> R.style.AppTheme_NoActionBarLaunch_Dark;
            case "pure-black" -> R.style.AppTheme_NoActionBarLaunch_PureBlack;
            default -> R.style.AppTheme_NoActionBarLaunch;
        };
    }

    static void persist(Activity activity, String setting) {
        activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putString(SETTING, setting).apply();
        if (Build.VERSION.SDK_INT >= 31) {
            // The OS persists this stable theme name for the next cold launch,
            // before any Activity or JavaScript is running. System mode uses night resources.
            activity.getSplashScreen().setSplashScreenTheme(launchTheme(setting));
        }
    }

    @SuppressWarnings("deprecation")
    static void apply(Activity activity, int backgroundColor, boolean dark) {
        Window window = activity.getWindow();
        window.setBackgroundDrawable(new ColorDrawable(backgroundColor));
        window.getDecorView().setBackgroundColor(backgroundColor);
        if (Build.VERSION.SDK_INT < 35) {
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
    }
}
