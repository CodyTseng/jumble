package com.codytseng.jumble;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "JumbleStorage")
public class JumbleStoragePlugin extends Plugin {
    private EncryptedStore store;

    @Override
    public void load() {
        store = new EncryptedStore(getContext());
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            store.getKey();
            JSObject result = new JSObject();
            result.put("available", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Android secure storage unavailable", error);
        }
    }

    @PluginMethod
    public void load(PluginCall call) {
        String name = call.getString("store");
        if (name == null) {
            call.reject("Missing store");
            return;
        }
        try {
            String value = store.load(name);
            JSObject result = new JSObject();
            result.put("value", value == null ? JSONObject.NULL : value);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Cannot read encrypted storage", error);
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("store");
        String value = call.getString("value");
        if (name == null || value == null) {
            call.reject("Missing store or value");
            return;
        }
        try {
            // Both stores contain JSON objects. Reject invalid payloads before writing.
            new JSONObject(value);
            store.save(name, value);
            call.resolve();
        } catch (Exception error) {
            call.reject("Cannot write encrypted storage", error);
        }
    }
}
