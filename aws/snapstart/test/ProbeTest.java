package morzsa.aws;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

public final class ProbeTest {
    public static void main(String[] args) throws Exception {
        Probe probe = new Probe();
        String value = "Morzsa – próba 🥣";
        String expected = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(value.getBytes(StandardCharsets.UTF_8)));
        HashSet<String> nonces = new HashSet<>();
        for (int i = 0; i < 100; i++) {
            Map<String, String> result = probe.handleRequest(Map.of("value", value));
            if (!expected.equals(result.get("digest")) || !nonces.add(result.get("nonce")))
                throw new AssertionError("Invalid digest or duplicated invocation nonce");
        }
        for (Map<String, String> input : List.of(Map.<String, String>of(),Map.of("value", "a".repeat(1001)))) {
            try { probe.handleRequest(input); throw new AssertionError("Invalid input accepted"); }
            catch (IllegalArgumentException expectedError) { /* expected */ }
        }
        try { probe.handleRequest(null); throw new AssertionError("Null input accepted"); }
        catch (IllegalArgumentException expectedError) { /* expected */ }
        System.out.println("Java probe passed: Unicode, input bounds, 100 unique request nonces.");
    }
}
