package com.codytseng.jumble;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.UUID;

/** NIP-55: remembered grants use the provider, interactive approval uses an Activity. */
@CapacitorPlugin(name = "JumbleSigner")
public class JumbleSignerPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private PluginCall pending;
    private CancellationSignal queryCancellation;
    private String requestId;

    @PluginMethod
    public void request(PluginCall call) {
        String type = call.getString("type", "");
        String payload = call.getString("payload", "");
        String pkg = call.getString("packageName", "");
        String user = call.getString("currentUser", "");
        String pubkey = call.getString("pubkey", "");
        if (!type.matches("get_public_key|sign_event|nip04_encrypt|nip04_decrypt|nip44_encrypt|nip44_decrypt") ||
            (!type.equals("get_public_key") &&
                (!pkg.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+") ||
                 !user.matches("[0-9a-f]{64}"))) ||
            ((type.endsWith("encrypt") || type.endsWith("decrypt")) && !pubkey.matches("[0-9a-f]{64}"))) {
            call.reject("Invalid Android signer request"); return;
        }
        main.post(() -> {
            if (pending != null) { call.reject("An Android signer request is already running"); return; }
            pending = call;
            requestId = UUID.randomUUID().toString();
            if (type.equals("get_public_key")) {
                openSigner(call); return;
            }
            CancellationSignal cancellation = new CancellationSignal();
            queryCancellation = cancellation;
            Runnable timeout = cancellation::cancel;
            main.postDelayed(timeout, 10000);
            // Content providers are synchronous IPC; never query on the UI thread.
            new Thread(() -> {
                JSObject response = null;
                boolean rejected = false;
                try (Cursor cursor = getContext().getContentResolver().query(
                    Uri.parse("content://" + pkg + "." + type.toUpperCase(Locale.ROOT)),
                    new String[] { payload, pubkey, user }, null, null, null, cancellation)) {
                    if (cursor != null) {
                        rejected = cursor.getColumnIndex("rejected") >= 0;
                        if (!rejected && cursor.moveToFirst()) {
                            int index = cursor.getColumnIndex("result");
                            int eventIndex = cursor.getColumnIndex("event");
                            if (index >= 0 && !cursor.isNull(index)) {
                                response = new JSObject();
                                response.put("result", cursor.getString(index));
                                if (eventIndex >= 0 && !cursor.isNull(eventIndex))
                                    response.put("event", cursor.getString(eventIndex));
                            }
                        }
                    }
                } catch (Exception ignored) {
                    // Missing provider/permission: ask interactively instead.
                }
                JSObject value = response;
                boolean denied = rejected;
                main.post(() -> {
                    main.removeCallbacks(timeout);
                    if (pending != call) return;
                    queryCancellation = null;
                    if (denied) finish(call, null, "Android signer rejected the request", "REJECTED");
                    else if (value != null) finish(call, value, null, null);
                    else openSigner(call);
                });
            }, "jumble-signer").start();
        });
    }

    private void openSigner(PluginCall call) {
        String type = call.getString("type", "");
        // Signers URI-decode the payload once. Escape literal percent sequences
        // as well as URI delimiters so the requested content survives unchanged.
        Intent intent = new Intent(Intent.ACTION_VIEW,
            Uri.parse("nostrsigner:" + Uri.encode(call.getString("payload", ""))));
        intent.putExtra("type", type);
        intent.putExtra("id", requestId);
        if (type.equals("get_public_key")) {
            intent.putExtra("permissions", "[{\"type\":\"sign_event\"},{\"type\":\"nip04_encrypt\"}," +
                "{\"type\":\"nip04_decrypt\"},{\"type\":\"nip44_encrypt\"},{\"type\":\"nip44_decrypt\"}]");
        } else {
            intent.setPackage(call.getString("packageName"));
            intent.putExtra("current_user", call.getString("currentUser"));
            if (call.getString("pubkey") != null) intent.putExtra("pubkey", call.getString("pubkey"));
        }
        try {
            startActivityForResult(call, intent, "signerResult");
        } catch (android.content.ActivityNotFoundException error) {
            finish(call, null, "Install an Android signer such as Amber to continue", "NOT_INSTALLED");
        } catch (Exception error) {
            finish(call, null, "Cannot open Android signer", "SIGNER_ERROR");
        }
    }

    @ActivityCallback
    private void signerResult(PluginCall call, ActivityResult activityResult) {
        if (call == null || pending != call) return;
        Intent data = activityResult.getData();
        if (activityResult.getResultCode() != Activity.RESULT_OK || data == null) {
            finish(call, null, "Android signer request cancelled or failed", "CANCELLED"); return;
        }
        if (data.getBooleanExtra("rejected", false) || "true".equals(data.getStringExtra("rejected"))) {
            finish(call, null, "Android signer rejected the request", "REJECTED"); return;
        }
        String id = data.getStringExtra("id");
        if (id != null && !id.equals(requestId)) {
            finish(call, null, "Android signer returned an unexpected request ID", "SIGNER_ERROR"); return;
        }
        String result = data.getStringExtra("result");
        String pkg = data.getStringExtra("package");
        if (result == null || (call.getString("type", "").equals("get_public_key") &&
            (pkg == null || !pkg.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+")))) {
            finish(call, null, "Android signer returned an invalid result", "SIGNER_ERROR"); return;
        }
        JSObject response = new JSObject();
        response.put("result", result);
        if (pkg != null) response.put("packageName", pkg);
        String event = data.getStringExtra("event");
        if (event != null) response.put("event", event);
        finish(call, response, null, null);
    }

    private void finish(PluginCall call, JSObject response, String error, String code) {
        if (pending != call) return;
        pending = null;
        requestId = null;
        if (response != null) call.resolve(response);
        else call.reject(error, code);
    }

    @Override protected void handleOnDestroy() {
        if (queryCancellation != null) queryCancellation.cancel();
        if (pending != null) finish(pending, null, "Android signer request interrupted", "CANCELLED");
    }
}
