/**
 * OpenRouter API key storage: optional encryption and masking.
 * When REDDIT_OPENROUTER_KEY_ENCRYPTION_SECRET is set, keys are encrypted at rest.
 * API never returns the full key; only a masked value (e.g. ********1234).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 16;
const KEY_LEN = 32;
const PREFIX = 'enc:';

function getEncryptionKey(): Buffer | null {
  const secret = process.env.REDDIT_OPENROUTER_KEY_ENCRYPTION_SECRET;
  if (!secret?.trim()) return null;
  return createHash('sha256').update(secret.trim()).digest();
}

/** Encrypt plaintext for storage. If secret not set, returns plaintext as-is. */
export function encryptKey(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, enc]);
  return PREFIX + combined.toString('base64');
}

/** Decrypt stored value. If not prefixed with PREFIX, returns as-is (plaintext). */
export function decryptKey(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return null;
  if (!stored.startsWith(PREFIX)) return stored;
  const key = getEncryptionKey();
  if (!key) return stored;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + 16);
    const enc = buf.subarray(IV_LEN + 16);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(enc).toString('utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

/** Return masked key for API/UI: all asterisks except last 4 chars (or last 4 if shorter). */
export function maskKey(key: string | null | undefined): string | null {
  if (key == null || key === '') return null;
  const k = String(key).trim();
  if (k.length <= 4) return '*'.repeat(k.length);
  return '*'.repeat(Math.max(0, k.length - 4)) + k.slice(-4);
}
