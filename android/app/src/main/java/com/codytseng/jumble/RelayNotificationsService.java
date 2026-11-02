package com.codytseng.jumble;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONArray;
import org.json.JSONObject;

/** Platform host only: shared TypeScript owns all Nostr protocol and notification rules. */
public class RelayNotificationsService extends Service {
    static volatile RelayNotificationsService instance;
    volatile boolean started;
    final AtomicInteger connected = new AtomicInteger(), subscriptions = new AtomicInteger();
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String CHANNEL = "relay-listener", ALERTS = "activity";
    private static final int FOREGROUND_ID = 9101;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService disk = Executors.newSingleThreadExecutor(), network = Executors.newFixedThreadPool(2);
    private final OkHttpClient socketsClient = new OkHttpClient.Builder().pingInterval(30, TimeUnit.SECONDS).build();
    private final Map<Integer, WebSocket> sockets = new ConcurrentHashMap<>();
    private final Set<Integer> earlyClosed = ConcurrentHashMap.newKeySet();
    private final Set<HttpURLConnection> requests = ConcurrentHashMap.newKeySet();
    private volatile long epoch;
    private WebView runtime;
    private android.net.ConnectivityManager connectivity;
    private final android.net.ConnectivityManager.NetworkCallback networkChanges = new android.net.ConnectivityManager.NetworkCallback() {
        @Override public void onAvailable(android.net.Network network) { publishNetwork(); }
        @Override public void onLost(android.net.Network network) { publishNetwork(); }
        @Override public void onCapabilitiesChanged(android.net.Network network, android.net.NetworkCapabilities caps) { publishNetwork(); }
    };
    private JSONObject config;
    private EncryptedStore storage;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (runtime != null) { runtime.resumeTimers(); runtime.evaluateJavascript("window.JumbleBackground?.tick()", null); }
            handler.postDelayed(this, 30_000);
        }
    };

    @Override public void onCreate() {
        super.onCreate(); instance = this; storage = new EncryptedStore(this);
        connectivity = getSystemService(android.net.ConnectivityManager.class);
        connectivity.registerDefaultNetworkCallback(networkChanges);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, getString(R.string.background_listener), NotificationManager.IMPORTANCE_LOW));
            manager.createNotificationChannel(new NotificationChannel(ALERTS, "Jumble", NotificationManager.IMPORTANCE_DEFAULT));
        }
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            getSharedPreferences("listener", MODE_PRIVATE).edit().putBoolean("enabled", false).putBoolean("pausedByUser", true).apply();
            stopSelf(); return START_NOT_STICKY;
        }
        if (!getSharedPreferences("listener", MODE_PRIVATE).getBoolean("enabled", false)) { stopSelf(); return START_NOT_STICKY; }
        ServiceCompat.startForeground(this, FOREGROUND_ID, ongoing(), Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0);
        try { config = new JSONObject(storage.load("notifications")); startRuntime(); return START_STICKY; }
        catch (Exception error) { fail("Cannot load background runtime configuration"); return START_NOT_STICKY; }
    }
    private void startRuntime() {
        stopRuntime(); final long session = epoch;
        runtime = new WebView(getApplicationContext());
        WebSettings settings = runtime.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) runtime.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        runtime.addJavascriptInterface(new RuntimeHost(session), "JumbleBackgroundHost");
        runtime.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) { return true; } // Never log relay payloads or config.
        });
        runtime.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return asset(request.getUrl()); }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (session == epoch) handler.postDelayed(() -> { if (session == epoch) startRuntime(); }, 1000);
                return true;
            }
        });
        runtime.onResume(); runtime.resumeTimers();
        runtime.loadUrl(ORIGIN + "/background/index.html");
        handler.postDelayed(tick, 30_000);
    }
    private WebResourceResponse asset(Uri uri) {
        String path = uri.getPath();
        if (!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost()) || path == null || path.contains("..") || path.contains("\\")) return empty(403);
        try {
            String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
            Map<String, String> headers = new java.util.HashMap<>();
            headers.put("Content-Security-Policy", "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse(mime, mime.startsWith("text/") ? "UTF-8" : null, 200, "OK", headers, getAssets().open("public" + path));
        } catch (Exception missing) { return empty(404); }
    }
    private WebResourceResponse empty(int code) {
        return new WebResourceResponse("text/plain", "UTF-8", code, "Unavailable", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private void call(long session, String method, JSONArray arguments) {
        handler.post(() -> {
            if (session == epoch && runtime != null) runtime.evaluateJavascript("window.JumbleBackground?." + method + "(..." + arguments.toString() + ")", null);
        });
    }
    private void result(long session, int id, Object value, String error) {
        call(session, "result", new JSONArray().put(id).put(value == null ? JSONObject.NULL : value).put(error == null ? JSONObject.NULL : error));
    }
    private void socketEvent(long session, int id, String type, String data, int code, String reason) {
        try {
            JSONObject event = new JSONObject().put("type", type).put("code", code).put("reason", reason);
            if (data != null) event.put("data", data);
            call(session, "socket", new JSONArray().put(id).put(event));
        } catch (Exception ignored) { }
    }
    private void openSocket(long session, int id, String url) {
        if (!url.startsWith("wss://")) { socketEvent(session, id, "close", null, 1006, "Secure connections required"); return; }
        try {
            WebSocket socket = socketsClient.newWebSocket(new Request.Builder().url(url).build(), new WebSocketListener() {
                private boolean open;
                @Override public void onOpen(WebSocket socket, Response response) {
                    if (session != epoch) { socket.cancel(); return; }
                    open = true; connected.incrementAndGet(); socketEvent(session, id, "open", null, 0, "");
                }
                @Override public void onMessage(WebSocket socket, String text) {
                    if (text.length() > 512 * 1024) { socket.close(1009, "Frame too large"); return; }
                    socketEvent(session, id, "message", text, 0, "");
                }
                @Override public void onClosing(WebSocket socket, int code, String reason) { socket.close(code, reason); }
                @Override public void onClosed(WebSocket socket, int code, String reason) { closed(socket, code, reason); }
                @Override public void onFailure(WebSocket socket, Throwable error, Response response) {
                    socketEvent(session, id, "error", null, 0, ""); closed(socket, 1006, "Connection failed");
                }
                private void closed(WebSocket socket, int code, String reason) {
                    if (session != epoch) return;
                    if (!sockets.remove(id, socket)) earlyClosed.add(id);
                    if (open) { open = false; connected.decrementAndGet(); }
                    socketEvent(session, id, "close", null, code, reason);
                }
            });
            sockets.put(id, socket);
            if (earlyClosed.remove(id)) sockets.remove(id, socket);
        } catch (Exception invalid) { socketEvent(session, id, "close", null, 1006, "Connection failed"); }
    }
    public final class RuntimeHost {
        private final long session;
        RuntimeHost(long session) { this.session = session; }
        @JavascriptInterface public boolean isOnline() { return online(); }
        @JavascriptInterface public boolean isForeground() { return MainActivity.visible; }
        @JavascriptInterface public void postMessage(String raw) {
            if (session != epoch || raw.length() > 2 * 1024 * 1024) return;
            try {
                JSONObject message = new JSONObject(raw); int id = message.optInt("id");
                switch (message.optString("op")) {
                    case "ready" -> disk.execute(() -> {
                        try {
                            if (session != epoch) return;
                            String cursor = storage.load("notification-cursor");
                            call(session, "configure", new JSONArray().put(config).put(cursor == null ? JSONObject.NULL : new JSONObject(cursor)));
                        } catch (Exception error) { handler.post(() -> { if (session == epoch) fail("Cannot restore notification cursor"); }); }
                    });
                    case "started" -> handler.post(() -> { if (session == epoch) { started = true; updateStatus(); } });
                    case "status" -> handler.post(() -> { if (session == epoch) { subscriptions.set(Math.max(0, message.optInt("subscriptions"))); updateStatus(); } });
                    case "error" -> handler.post(() -> { if (session == epoch) fail("Background JavaScript runtime failed"); });
                    case "saveCursor" -> disk.execute(() -> {
                        if (session != epoch) return;
                        try { storage.save("notification-cursor", message.getJSONObject("cursor").toString()); result(session, id, true, null); }
                        catch (Exception error) { result(session, id, null, "Cannot save notification cursor"); }
                    });
                    case "notify" -> handler.post(() -> {
                        if (session != epoch) return;
                        try {
                            if (!MainActivity.visible) showAlert(message.optString("notificationId"), message.optString("body"));
                            result(session, id, true, null);
                        } catch (Exception error) { result(session, id, null, "Cannot show notification"); }
                    });
                    case "fetch" -> network.execute(() -> fetch(session, id, message));
                    case "socketOpen" -> openSocket(session, message.optInt("socketId"), message.optString("url"));
                    case "socketSend" -> { WebSocket socket = sockets.get(message.optInt("socketId")); if (socket != null && !socket.send(message.optString("data"))) socket.cancel(); }
                    case "socketClose" -> {
                        WebSocket socket = sockets.get(message.optInt("socketId"));
                        if (socket != null) {
                            try { socket.close(message.optInt("code", 1000), ""); } catch (Exception error) { socket.cancel(); }
                        }
                    }
                }
            } catch (Exception invalid) { /* Reject malformed platform messages without interpreting relay data. */ }
        }
    }
    private void fetch(long session, int id, JSONObject request) {
        if (session != epoch) return;
        HttpURLConnection connection = null;
        try {
            URL url = new URL(request.getString("url"));
            if (!url.getProtocol().equals("https") || url.getUserInfo() != null) throw new java.io.IOException();
            connection = (HttpURLConnection) url.openConnection(); requests.add(connection);
            connection.setConnectTimeout(10_000); connection.setReadTimeout(10_000);
            String method = request.optString("method", "GET");
            if (!method.equals("GET") && !method.equals("POST")) throw new java.io.IOException();
            connection.setRequestMethod(method); connection.setRequestProperty("Content-Type", "application/json");
            if (request.has("body")) {
                connection.setDoOutput(true);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(request.getString("body").getBytes(StandardCharsets.UTF_8)); }
            }
            int status = connection.getResponseCode();
            try (InputStream input = status < 400 ? connection.getInputStream() : connection.getErrorStream(); ByteArrayOutputStream body = new ByteArrayOutputStream()) {
                if (input == null) throw new java.io.IOException();
                byte[] bytes = new byte[8192]; int count;
                while ((count = input.read(bytes)) != -1) { if (body.size() + count > 1024 * 1024) throw new java.io.IOException(); body.write(bytes, 0, count); }
                result(session, id, new JSONObject().put("status", status).put("body", body.toString("UTF-8")), null);
            }
        } catch (Exception error) { result(session, id, null, "Background HTTP request failed"); }
        finally { if (connection != null) { requests.remove(connection); connection.disconnect(); } }
    }
    private boolean online() {
        android.net.Network network = connectivity.getActiveNetwork();
        android.net.NetworkCapabilities caps = network == null ? null : connectivity.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
    private void publishNetwork() {
        handler.post(() -> { if (runtime != null) runtime.evaluateJavascript("window.JumbleBackground?.network(" + online() + ")", null); });
    }
    private void showAlert(String id, String body) {
        NotificationCompat.Builder alert = new NotificationCompat.Builder(this, ALERTS).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Jumble").setContentText(body).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(openNotifications(id.hashCode()));
        getSystemService(NotificationManager.class).notify("relay:" + id, id.hashCode() & 0x7fffffff, alert.build());
    }
    private android.app.Notification ongoing() {
        PendingIntent stop = PendingIntent.getService(this, 9102, new Intent(this, RelayNotificationsService.class).setAction("STOP"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("Jumble")
            .setContentText(getString(subscriptions.get() > 0 ? R.string.background_listener : R.string.background_connecting))
            .setOngoing(true).setSilent(true).setContentIntent(openNotifications(9103)).addAction(0, getString(R.string.stop_listening), stop).build();
    }
    private PendingIntent openNotifications(int id) {
        return PendingIntent.getActivity(this, id, new Intent(this, MainActivity.class).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("https://jumble.social/?page=notifications")).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private void updateStatus() { try { getSystemService(NotificationManager.class).notify(FOREGROUND_ID, ongoing()); } catch (SecurityException revoked) { stopSelf(); } }
    private void fail(String message) {
        getSharedPreferences("listener", MODE_PRIVATE).edit().putString("lastError", message).apply(); started = false; stopSelf();
    }
    void resumeRuntime() { handler.post(() -> { if (runtime != null) runtime.resumeTimers(); }); }
    private void stopRuntime() {
        epoch++; started = false; handler.removeCallbacksAndMessages(null); connected.set(0); subscriptions.set(0);
        sockets.values().forEach(WebSocket::cancel); sockets.clear(); earlyClosed.clear(); requests.forEach(HttpURLConnection::disconnect);
        if (runtime != null) { runtime.removeJavascriptInterface("JumbleBackgroundHost"); runtime.stopLoading(); runtime.destroy(); runtime = null; }
    }
    @Override public void onDestroy() {
        connectivity.unregisterNetworkCallback(networkChanges);
        stopRuntime(); disk.shutdownNow(); network.shutdownNow(); socketsClient.dispatcher().cancelAll(); socketsClient.connectionPool().evictAll();
        instance = null; super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
