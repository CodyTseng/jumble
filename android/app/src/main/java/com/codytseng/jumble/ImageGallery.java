package com.codytseng.jumble;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

final class ImageGallery {
    @SuppressWarnings("deprecation")
    static Uri save(Context context, File source, String filename, String mimeType) throws IOException {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
            values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Jumble");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("Cannot create image in photos");
            try {
                try (OutputStream output = resolver.openOutputStream(uri)) {
                    if (output == null) throw new IOException("Cannot open image destination");
                    copy(source, output);
                }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                if (resolver.update(uri, values, null, null) == 0) throw new IOException("Cannot finish saving image");
                return uri;
            } catch (Exception error) {
                resolver.delete(uri, null, null);
                throw error;
            }
        }
        File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Jumble");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create Pictures/Jumble");
        int dot = filename.lastIndexOf('.');
        String base = dot > 0 ? filename.substring(0, dot) : filename;
        String extension = dot > 0 ? filename.substring(dot) : "";
        File destination = File.createTempFile(base.length() < 3 ? "image-" : base + "-", extension, directory);
        try (OutputStream output = new FileOutputStream(destination)) {
            copy(source, output);
        } catch (Exception error) {
            destination.delete();
            throw error;
        }
        MediaScannerConnection.scanFile(context, new String[] { destination.getAbsolutePath() }, new String[] { mimeType }, null);
        return Uri.fromFile(destination);
    }

    private static void copy(File file, OutputStream output) throws IOException {
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }
    }
}
