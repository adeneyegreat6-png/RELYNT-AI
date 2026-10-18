import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// TOKEN_ENCRYPTION_KEY is 32 random bytes, base64-encoded:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function key(): Buffer {
  const k = Buffer.from(env.tokenEncryptionKey, "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64).");
  return k;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Signed, expiring OAuth `state` so a callback can't be forged or replayed
// against a different user.
export function signState(userId: string): string {
  const body = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + 10 * 60_000, n: randomBytes(8).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): string | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const { u, e } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (typeof u !== "string" || typeof e !== "number" || Date.now() > e) return null;
  return u;
}
