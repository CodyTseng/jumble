package com.codytseng.jumble;

import android.Manifest;
import android.os.Build;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "JumbleMedia", permissions = {
    @Permission(alias = "legacyStorage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
public class JumbleMediaPlugin extends Plugin {
    private static final long MAX_IMAGE_BYTES = 50L * 1024 * 1024;
    private final ExecutorService downloads = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void saveImage(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29 && getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "storagePermissionResult");
            return;
        }
        save(call);
    }

    @PermissionCallback
    private void storagePermissionResult(PluginCall call) {
        if (getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            call.reject("Storage permission is required to save photos on this Android version");
            return;
        }
        save(call);
    }

    private void save(PluginCall call) {
        downloads.execute(() -> {
            File temporary = null;
            try {
                temporary = File.createTempFile("jumble-image-", ".tmp", getContext().getCacheDir());
                String url = call.getString("url");
                String mimeType;
                if (url != null) {
                    mimeType = download(url, temporary);
                } else {
                    String data = call.getString("data");
                    mimeType = call.getString("mimeType", "");
                    if (data == null || data.length() > (MAX_IMAGE_BYTES * 4 / 3 + 4)) {
                        throw new IOException("Missing image data or image exceeds 50 MB");
                    }
                    byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                    if (bytes.length == 0 || bytes.length > MAX_IMAGE_BYTES) throw new IOException("Invalid image size");
                    try (FileOutputStream output = new FileOutputStream(temporary)) { output.write(bytes); }
                }
                mimeType = mimeType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
                if (!mimeType.startsWith("image/")) throw new IOException("The downloaded file is not an image");
                String filename = filename(call.getString("filename", "image"), mimeType);
                String uri = ImageGallery.save(getContext(), temporary, filename, mimeType).toString();
                JSObject result = new JSObject();
                result.put("uri", uri);
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage() == null ? "Unable to save image" : error.getMessage(), error);
            } finally {
                if (temporary != null) temporary.delete();
            }
        });
    }

    private String download(String source, File destination) throws IOException {
        URL url = new URL(source);
        for (int redirects = 0; redirects <= 5; redirects++) {
            if (!url.getProtocol().equals("https") && !url.getProtocol().equals("http")) {
                throw new IOException("Unsupported image URL");
            }
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(15_000);
            connection.setRequestProperty("Accept", "image/*");
            try {
                int status = connection.getResponseCode();
                if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IOException("Invalid image redirect");
                    url = new URL(url, location);
                    continue;
                }
                if (status < 200 || status >= 300) throw new IOException("Failed to download image: HTTP " + status);
                if (connection.getContentLengthLong() > MAX_IMAGE_BYTES) throw new IOException("Image exceeds 50 MB");
                String mimeType = connection.getContentType();
                try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                     FileOutputStream output = new FileOutputStream(destination)) {
                    if (mimeType == null || !mimeType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                        mimeType = URLConnection.guessContentTypeFromStream(input);
                        if (mimeType == null) mimeType = URLConnection.guessContentTypeFromName(url.getPath());
                    }
                    if (mimeType == null || !mimeType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                        throw new IOException("The downloaded file is not an image");
                    }
                    byte[] buffer = new byte[16 * 1024];
                    long total = 0;
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_IMAGE_BYTES) throw new IOException("Image exceeds 50 MB");
                        output.write(buffer, 0, count);
                    }
                    if (total == 0) throw new IOException("The downloaded image is empty");
                }
                return mimeType;
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Too many image redirects");
    }

    private static String filename(String proposed, String mimeType) {
        String clean = proposed.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (clean.isEmpty()) clean = "image";
        if (clean.length() > 160) clean = clean.substring(0, 160);
        String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
        if (extension != null) {
            int dot = clean.lastIndexOf('.');
            String existing = dot >= 0 ? clean.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
            String existingType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(existing);
            if (!mimeType.equals(existingType)) {
                if (existingType != null && existingType.startsWith("image/")) clean = clean.substring(0, dot);
                clean += "." + extension;
            }
        }
        return clean;
    }

    @Override
    protected void handleOnDestroy() {
        downloads.shutdownNow();
    }
}
