import { describe, test, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { signOAuthState, verifyOAuthState } from "@/lib/email/gmail";

beforeAll(() => {
  process.env.CLERK_SECRET_KEY = "sk_test_deterministic_key_for_tests_only";
});

describe("crypto (refresh token at rest)", () => {
  test("round-trips a secret", () => {
    const secret = "1//0gExampleRefreshToken";
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
  });

  test("two encryptions of the same value produce different ciphertext (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
  });

  test("rejects a tampered ciphertext", () => {
    const stored = encryptSecret("1//0gExampleRefreshToken");
    const [iv, tag, data] = stored.split(":");
    const tampered = `${iv}:${tag}:${data.slice(0, -4)}AAAA`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("OAuth state (CSRF protection)", () => {
  test("a freshly signed state verifies for its own user", () => {
    const state = signOAuthState("user_123");
    expect(verifyOAuthState(state, "user_123")).toBe(true);
  });

  test("rejects a state signed for a different user", () => {
    const state = signOAuthState("user_123");
    expect(verifyOAuthState(state, "user_456")).toBe(false);
  });

  test("rejects a tampered state payload", () => {
    const state = signOAuthState("user_123");
    const [payloadB64, sig] = state.split(".");
    const forged = `${Buffer.from(JSON.stringify({ uid: "user_456", ts: Date.now(), nonce: "x" })).toString("base64url")}.${sig}`;
    expect(verifyOAuthState(forged, "user_456")).toBe(false);
    expect(payloadB64).toBeTruthy();
  });

  test("rejects a missing or malformed state", () => {
    expect(verifyOAuthState(null, "user_123")).toBe(false);
    expect(verifyOAuthState("not-a-real-state", "user_123")).toBe(false);
  });
});
