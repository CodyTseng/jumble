package com.codytseng.jumble;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "JumbleFiles")
public class JumbleFilesPlugin extends Plugin {
    @PluginMethod
    public void saveText(PluginCall call) {
        String text = call.getString("text");
        String filename = call.getString("filename");
        if (text == null || text.length() > 1024 * 1024 || filename == null) {
            call.reject("Invalid text file");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE).setType("text/plain")
            .putExtra(Intent.EXTRA_TITLE, filename.replaceAll("[\\\\/\\p{Cntrl}]", "_"));
        try { startActivityForResult(call, intent, "fileSelected"); }
        catch (RuntimeException error) { call.reject("Cannot open the system file picker", error); }
    }

    @ActivityCallback
    private void fileSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("saved", false);
            call.resolve(cancelled);
            return;
        }
        Uri uri = result.getData().getData();
        // Write directly to the user-selected destination, never a plaintext cache file.
        getBridge().execute(() -> {
            try {
                try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new java.io.IOException("Cannot open selected file");
                    output.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
                }
                JSObject saved = new JSObject();
                saved.put("saved", true);
                call.resolve(saved);
            } catch (Exception error) {
                call.reject("Unable to save selected file", error);
            }
        });
    }
}
