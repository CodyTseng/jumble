package com.codytseng.jumble;

import static org.junit.Assert.*;

import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.lang.reflect.Method;
import java.net.URLDecoder;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Exercises the actual interactive launch boundary without opening a real signer/account. */
@RunWith(AndroidJUnit4.class)
public class SignerIntentTest {
    private static final String PACKAGE = "com.example.signer";
    private static final String PUBKEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    private static class CapturingSigner extends JumbleSignerPlugin {
        Intent launched;
        PluginCall launchedCall;
        String callback;

        @Override public void startActivityForResult(PluginCall call, Intent intent, String callbackName) {
            launched = intent;
            launchedCall = call;
            callback = callbackName;
        }
    }

    private Intent launch(String type, String payload) throws Exception {
        JSObject options = new JSObject();
        options.put("type", type);
        options.put("payload", payload);
        options.put("packageName", PACKAGE);
        options.put("currentUser", PUBKEY);
        options.put("pubkey", PUBKEY);
        PluginCall call = new PluginCall(null, "JumbleSigner", "test", "request", options);
        CapturingSigner plugin = new CapturingSigner();
        Method openSigner = JumbleSignerPlugin.class.getDeclaredMethod("openSigner", PluginCall.class);
        openSigner.setAccessible(true);
        openSigner.invoke(plugin, call);
        assertSame(call, plugin.launchedCall);
        assertEquals("signerResult", plugin.callback);
        assertEquals(Intent.ACTION_VIEW, plugin.launched.getAction());
        assertEquals(type, plugin.launched.getStringExtra("type"));
        if (!type.equals("get_public_key")) {
            assertEquals(PACKAGE, plugin.launched.getPackage());
            assertEquals(PUBKEY, plugin.launched.getStringExtra("current_user"));
        }
        return plugin.launched;
    }

    private String signerPayload(Intent intent) throws Exception {
        // Amber's native intent parser decodes the data string once, preserving '+'.
        String data = intent.getDataString();
        assertTrue(data.startsWith("nostrsigner:"));
        return URLDecoder.decode(data.substring("nostrsigner:".length()).replace("+", "%2b"), "utf-8");
    }

    @Test public void signingPreservesPercentEscapesInsideEventJson() throws Exception {
        String content = "https://example.com/a%20b?x=%2520&y=%2B#片段 + 100% 😀";
        JSONObject event = new JSONObject();
        event.put("kind", 1);
        event.put("content", content);
        String payload = event.toString();
        Intent intent = launch("sign_event", payload);
        assertTrue(intent.getDataString().contains("a%2520b"));
        assertEquals(payload, signerPayload(intent));
        assertEquals(content, new JSONObject(signerPayload(intent)).getString("content"));
    }

    @Test public void encryptionPreservesLiteralPercentSignsUnicodeAndUriDelimiters() throws Exception {
        String payload = "https://example.com/a%20b %25 %2520 %2B + % ? & # / 中文 مرحبا 😀\nnext";
        for (String type : new String[] { "nip04_encrypt", "nip44_encrypt" }) {
            Intent intent = launch(type, payload);
            assertEquals(PUBKEY, intent.getStringExtra("pubkey"));
            assertEquals(payload, signerPayload(intent));
        }
    }

    @Test public void publicKeyRequestKeepsAnEmptyPayload() throws Exception {
        Intent intent = launch("get_public_key", "");
        assertEquals("nostrsigner:", intent.getDataString());
        assertEquals("", signerPayload(intent));
        assertNull(intent.getPackage());
    }
}
