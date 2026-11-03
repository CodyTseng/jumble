package com.codytseng.jumble;

import static org.junit.Assert.*;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 29)
public class ImageGalleryTest {
    @Test
    public void savesOriginalImageBytesInPhotosWithoutReadPermissions() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File source = File.createTempFile("gallery-test-", ".png", context.getCacheDir());
        Uri saved = null;
        Bitmap bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888);
        ByteArrayOutputStream encoded = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, encoded);
        bitmap.recycle();
        byte[] original = encoded.toByteArray();
        try {
            try (FileOutputStream output = new FileOutputStream(source)) { output.write(original); }
            saved = ImageGallery.save(context, source, "jumble-gallery-test.png", "image/png");
            try (InputStream input = context.getContentResolver().openInputStream(saved);
                 ByteArrayOutputStream result = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[1024];
                int count;
                while ((count = input.read(buffer)) != -1) result.write(buffer, 0, count);
                assertArrayEquals(original, result.toByteArray());
            }
            try (Cursor cursor = context.getContentResolver().query(saved,
                new String[] { MediaStore.Images.Media.RELATIVE_PATH, MediaStore.Images.Media.IS_PENDING }, null, null, null)) {
                assertTrue(cursor.moveToFirst());
                assertEquals("Pictures/Jumble/", cursor.getString(0));
                assertEquals(0, cursor.getInt(1));
            }
        } finally {
            if (saved != null) context.getContentResolver().delete(saved, null, null);
            source.delete();
        }
    }

    @Test
    public void removesPendingGalleryEntriesWhenWritingFails() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String filename = "jumble-missing-" + System.nanoTime() + ".png";
        try {
            ImageGallery.save(context, new File(context.getCacheDir(), filename), filename, "image/png");
            fail("Missing source must fail");
        } catch (java.io.IOException expected) {
            try (Cursor cursor = context.getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                new String[] { MediaStore.Images.Media._ID }, MediaStore.Images.Media.DISPLAY_NAME + " = ?",
                new String[] { filename }, null)) {
                assertEquals(0, cursor.getCount());
            }
        }
    }
}
