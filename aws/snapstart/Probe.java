package morzsa.aws;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/** IAM-invoked runtime probe. No network, credentials, user data or writes. */
public final class Probe {
    public Map<String, String> handleRequest(Map<String, String> event) throws Exception {
        String value = event == null ? null : event.get("value");
        if (value == null || value.length() > 1000) {
            throw new IllegalArgumentException("value must be a string of at most 1000 UTF-16 units");
        }
        String digest = HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        // Generate uniqueness during invocation, never in snapshotted initialization.
        return Map.of("digest", digest, "nonce", UUID.randomUUID().toString(), "runtime", "java21");
    }
}
