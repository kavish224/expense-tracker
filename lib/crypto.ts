// Symmetric encryption for sensitive values we store at rest (currently: the
// Gmail OAuth refresh token, which grants read access to a user's entire inbox —
// plaintext-in-Postgres was the wrong bar for that). Key material is derived via
// HMAC-SHA256 from CLERK_SECRET_KEY rather than requiring a brand-new secret to
// provision and rotate — a standard single-root-secret → purpose-specific-subkey
// pattern (the same idea as Rails' `secret_key_base` deriving multiple keys).
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

function deriveKey(purpose: string): Buffer {
  const root = process.env.CLERK_SECRET_KEY;
  if (!root) throw new Error("CLERK_SECRET_KEY is required (used as key-derivation root)");
  return createHmac("sha256", root).update(purpose).digest();
}

const GMAIL_TOKEN_KEY = () => deriveKey("gmail-refresh-token-encryption-v1");

// Format: "<iv>:<authTag>:<ciphertext>", each base64 — self-contained, no
// separate column needed for the IV/tag.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit nonce, standard for GCM
  const cipher = createCipheriv("aes-256-gcm", GMAIL_TOKEN_KEY(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", GMAIL_TOKEN_KEY(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
