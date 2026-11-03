package com.codytseng.jumble;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.ContextWrapper;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class EncryptedStoreTest {
    private Context context;
    private EncryptedStore store;

    @Before
    public void setUp() {
        // Use an isolated directory under the target UID, never real account files.
        context = new ContextWrapper(InstrumentationRegistry.getInstrumentation().getTargetContext()) {
            @Override
            public File getNoBackupFilesDir() {
                return new File(getCacheDir(), "encrypted-store-tests");
            }
        };
        store = new EncryptedStore(context);
    }

    @Test
    public void encryptsWithFreshNoncesAndSurvivesReopening() throws Exception {
        String secret = "{\"nsec\":{\"test\":\"private-key-test-value\"}}";
        store.save("secrets", secret);
        File file = new File(context.getNoBackupFilesDir(), "jumble/secrets.enc");
        byte[] first = Files.readAllBytes(file.toPath());
        assertFalse(new String(first, StandardCharsets.UTF_8).contains("private-key-test-value"));
        assertEquals(secret, new EncryptedStore(context).load("secrets"));
        store.save("secrets", secret);
        assertFalse(Arrays.equals(first, Files.readAllBytes(file.toPath())));
    }

    @Test
    public void rejectsTamperedCiphertextWithoutOverwritingIt() throws Exception {
        store.save("secrets", "{\"test\":true}");
        File file = new File(context.getNoBackupFilesDir(), "jumble/secrets.enc");
        byte[] bytes = Files.readAllBytes(file.toPath());
        bytes[bytes.length - 1] ^= 1;
        Files.write(file.toPath(), bytes);
        try {
            store.load("secrets");
            fail("Corrupt ciphertext must not decrypt");
        } catch (java.security.GeneralSecurityException expected) {
            assertArrayEquals(bytes, Files.readAllBytes(file.toPath()));
        }
    }

    @Test
    public void bindsCiphertextToItsStore() throws Exception {
        store.save("secrets", "{\"test\":true}");
        File directory = new File(context.getNoBackupFilesDir(), "jumble");
        Files.write(new File(directory, "state.enc").toPath(),
            Files.readAllBytes(new File(directory, "secrets.enc").toPath()));
        try {
            store.load("state");
            fail("Secrets must not be accepted as state");
        } catch (java.security.GeneralSecurityException expected) {
            // The store name is authenticated along with the ciphertext.
        }
    }
}
