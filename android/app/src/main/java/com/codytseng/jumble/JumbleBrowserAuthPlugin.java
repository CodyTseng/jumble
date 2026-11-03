package com.codytseng.jumble;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.activity.result.ActivityResult;
import androidx.browser.customtabs.CustomTabsIntent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** A short-lived loopback relay for system-browser authorization, never a WebView. */
@CapacitorPlugin(name = "JumbleBrowserAuth")
public class JumbleBrowserAuthPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private Session session;

    @PluginMethod
    public void authenticate(PluginCall call) {
        String id = call.getString("requestId", "");
        String page = call.getString("page", "");
        String csp = call.getString("csp", "");
        if (!id.matches("[a-f0-9]{64}") || page.isEmpty() || page.length() > 256 * 1024 ||
            csp.isEmpty() || csp.contains("\r") || csp.contains("\n")) {
            call.reject("Invalid browser authorization request"); return;
        }
        main.post(() -> {
            if (session != null) { call.reject("An authorization request is already running"); return; }
            try {
                Session pending = new Session(call, id, page, csp);
                session = pending;
                pending.start();
                int height = Build.VERSION.SDK_INT >= 30
                    ? getActivity().getWindowManager().getCurrentWindowMetrics().getBounds().height()
                    : getContext().getResources().getDisplayMetrics().heightPixels;
                Intent intent = new CustomTabsIntent.Builder().setShowTitle(true)
                    .setInitialActivityHeightPx(Math.max(1, Math.round(height * 0.7f)))
                    .build().intent;
                intent.setData(Uri.parse(pending.origin + pending.path));
                startActivityForResult(call, intent, "browserClosed");
            } catch (Exception error) {
                if (session != null) finish(session, null, "Cannot open authorization browser", null);
                else call.reject("Cannot open authorization browser", error);
            }
        });
    }

    @ActivityCallback
    private void browserClosed(PluginCall call, ActivityResult result) {
        // A previous browser's late result must not cancel a newer session.
        if (session != null && session.call == call) finish(session, null, "Authorization cancelled", "CANCELLED");
    }

    private void finish(Session pending, String value, String error, String code) {
        if (session != pending) return;
        session = null;
        main.removeCallbacks(pending.timeout);
        pending.close();
        if (value != null) {
            // Reuse the existing Activity and clear the Custom Tab above it.
            // Returning is native, so browser gesture restrictions cannot leave
            // the user on a completion page. No credentials travel in an Intent.
            getActivity().startActivity(new Intent(getContext(), MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
            JSObject result = new JSObject(); result.put("value", value); pending.call.resolve(result);
        } else pending.call.reject(error, code);
    }

    @Override protected void handleOnDestroy() {
        if (session != null) finish(session, null, "Authorization interrupted", "CANCELLED");
    }

    private final class Session {
        final PluginCall call;
        final ServerSocket server;
        final String origin, host, path, page, csp;
        final Runnable timeout = () -> finish(this, null, "Timed out waiting for Google sign-in", null);
        volatile Socket connection;
        volatile boolean closed;

        Session(PluginCall call, String id, String page, String csp) throws IOException {
            this.call = call; this.page = page; this.csp = csp;
            server = new ServerSocket(0, 4, InetAddress.getByName("127.0.0.1"));
            host = "127.0.0.1:" + server.getLocalPort();
            origin = "http://" + host;
            path = "/pomegranate-auth/" + id;
        }

        void start() {
            main.postDelayed(timeout, 5 * 60 * 1000);
            new Thread(() -> {
                while (!closed) {
                    try (Socket socket = server.accept()) {
                        connection = socket;
                        if (closed) break;
                        socket.setSoTimeout(5000);
                        handle(socket);
                    } catch (IOException ignored) {
                        // Bad/incomplete requests cannot terminate a valid authorization session.
                    } finally { connection = null; }
                }
            }, "jumble-browser-auth").start();
        }

        void close() {
            closed = true;
            try { server.close(); } catch (IOException ignored) {}
            Socket socket = connection;
            if (socket != null) try { socket.close(); } catch (IOException ignored) {}
        }

        void handle(Socket socket) throws IOException {
            InputStream input = new BufferedInputStream(socket.getInputStream());
            String[] request = line(input).split(" ");
            Map<String, String> headers = new HashMap<>();
            int size = 0;
            for (;;) {
                String line = line(input);
                size += line.length();
                if (size > 16 * 1024) { respond(socket, 413, "text/plain", "Request too large"); return; }
                if (line.isEmpty()) break;
                int colon = line.indexOf(':');
                if (colon <= 0) return;
                String key = line.substring(0, colon).toLowerCase(Locale.ROOT);
                if (headers.put(key, line.substring(colon + 1).trim()) != null) return;
            }
            if (request.length != 3 || !host.equals(headers.get("host"))) {
                respond(socket, 421, "text/plain", "Misdirected request"); return;
            }
            if (request[0].equals("GET") && request[1].equals(path)) {
                respond(socket, 200, "text/html; charset=utf-8", page); return;
            }
            if (!request[0].equals("POST") || !request[1].equals(path + "/complete")) {
                respond(socket, 404, "text/plain", "Not found"); return;
            }
            // No CORS: only the relay page can submit results. The random path
            // and literal Host check also protect against cross-site requests/DNS rebinding.
            if (!origin.equals(headers.get("origin")) || !"application/json".equalsIgnoreCase(headers.getOrDefault("content-type", "").split(";", 2)[0].trim()) || headers.containsKey("transfer-encoding")) {
                respond(socket, 403, "text/plain", "Forbidden"); return;
            }
            try {
                int length = Integer.parseInt(headers.getOrDefault("content-length", "0"));
                if (length <= 0 || length > 64 * 1024) { respond(socket, 413, "text/plain", "Invalid result size"); return; }
                byte[] bytes = new byte[length];
                int offset = 0;
                while (offset < length) {
                    int count = input.read(bytes, offset, length - offset);
                    if (count < 0) throw new EOFException();
                    offset += count;
                }
                Object result = new JSONObject(new String(bytes, StandardCharsets.UTF_8)).opt("value");
                if (!(result instanceof String) || ((String) result).isEmpty()) {
                    respond(socket, 400, "application/json", "{\"error\":\"Invalid result\"}"); return;
                }
                respond(socket, 200, "application/json", "{\"done\":true}");
                main.post(() -> finish(this, (String) result, null, null));
            } catch (NumberFormatException | org.json.JSONException error) {
                respond(socket, 400, "application/json", "{\"error\":\"Invalid result\"}");
            }
        }

        void respond(Socket socket, int status, String type, String body) throws IOException {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            String headers = "HTTP/1.1 " + status + " Response\r\nContent-Type: " + type +
                "\r\nContent-Length: " + bytes.length + "\r\nConnection: close\r\nCache-Control: no-store" +
                "\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer" +
                "\r\nContent-Security-Policy: " + csp + "\r\n\r\n";
            OutputStream output = socket.getOutputStream();
            output.write(headers.getBytes(StandardCharsets.US_ASCII)); output.write(bytes); output.flush();
        }
    }

    private static String line(InputStream input) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        for (int c; (c = input.read()) != -1;) {
            if (c == '\n') return bytes.toString(StandardCharsets.US_ASCII.name()).replace("\r", "");
            if (bytes.size() >= 8192) throw new IOException("Header too long");
            bytes.write(c);
        }
        throw new EOFException();
    }
}
