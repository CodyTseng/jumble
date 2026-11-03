package com.codytseng.jumble;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Atomic, authenticated storage; the encryption key never leaves Android Keystore. */
final class EncryptedStore {
    private static final String KEY_ALIAS = "jumble.storage.v1";
    private static final byte[] MAGIC = "JUMBLE-ANDROID1".getBytes(StandardCharsets.US_ASCII);
    private static final int IV_LENGTH = 12;
    private final File directory;

    EncryptedStore(Context context) {
        directory = new File(context.getNoBackupFilesDir(), "jumble");
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new IllegalStateException("Cannot create encrypted storage directory");
        }
    }

    private AtomicFile file(String store) {
        if (!store.equals("secrets") && !store.equals("state") && !store.equals("notifications") && !store.equals("notification-cursor")) {
            throw new IllegalArgumentException("Unknown store");
        }
        return new AtomicFile(new File(directory, store + ".enc"));
    }

    synchronized SecretKey getKey() throws Exception {
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore");
        keys.load(null);
        if (keys.containsAlias(KEY_ALIAS)) {
            return (SecretKey) keys.getKey(KEY_ALIAS, null);
        }
        // Never replace a lost key while encrypted data still exists.
        String[] files = directory.list();
        if (files == null || files.length != 0) {
            throw new IllegalStateException("Encrypted storage key is missing");
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return generator.generateKey();
    }

    synchronized String load(String store) throws Exception {
        AtomicFile file = file(store);
        // AtomicFile also recovers an interrupted write's backup file.
        if (!file.getBaseFile().exists() &&
            !new File(file.getBaseFile().getPath() + ".bak").exists()) return null;
        byte[] bytes = file.readFully();
        if (bytes.length < MAGIC.length + IV_LENGTH + 16 ||
            !Arrays.equals(MAGIC, Arrays.copyOfRange(bytes, 0, MAGIC.length))) {
            throw new IllegalStateException("Invalid encrypted storage format");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128,
            Arrays.copyOfRange(bytes, MAGIC.length, MAGIC.length + IV_LENGTH)));
        cipher.updateAAD(store.getBytes(StandardCharsets.US_ASCII));
        return new String(cipher.doFinal(bytes, MAGIC.length + IV_LENGTH,
            bytes.length - MAGIC.length - IV_LENGTH), StandardCharsets.UTF_8);
    }

    synchronized void save(String store, String value) throws Exception {
        AtomicFile file = file(store);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getKey());
        cipher.updateAAD(store.getBytes(StandardCharsets.US_ASCII));
        byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        FileOutputStream output = null;
        try {
            output = file.startWrite();
            output.write(MAGIC);
            output.write(cipher.getIV());
            output.write(ciphertext);
            file.finishWrite(output);
        } catch (Exception error) {
            if (output != null) file.failWrite(output);
            throw error;
        }
    }
}
