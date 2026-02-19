/**
 * Encryption at rest – key derivation and AES-256-GCM helpers.
 * Used by file storage and database to encrypt data before writing to disk.
 */

import crypto from "crypto";
import { encryption as encryptionConfig } from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const FILE_INFO = "file-storage-v1";
const DB_INFO = "db-sensitive-v1";

let fileDek: Buffer | null = null;
let dbDek: Buffer | null = null;

function getFileDek(): Buffer | null {
  if (fileDek) return fileDek;
  if (!encryptionConfig.enabled || !encryptionConfig.masterKey) return null;
  fileDek = Buffer.from(
    crypto.hkdfSync(
      "sha256",
      encryptionConfig.masterKey,
      Buffer.alloc(0),
      FILE_INFO,
      KEY_LENGTH,
    ),
  );
  return fileDek;
}

function getDbDek(): Buffer | null {
  if (dbDek) return dbDek;
  if (!encryptionConfig.enabled || !encryptionConfig.masterKey) return null;
  dbDek = Buffer.from(
    crypto.hkdfSync(
      "sha256",
      encryptionConfig.masterKey,
      Buffer.alloc(0),
      DB_INFO,
      KEY_LENGTH,
    ),
  );
  return dbDek;
}

/**
 * Encrypted payload format: [iv 12B][authTag 16B][ciphertext]
 */
function encrypt(key: Buffer, plaintext: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt payload in format [iv 12B][authTag 16B][ciphertext]
 */
function decrypt(key: Buffer, payload: Buffer): Buffer {
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Payload too short for encrypted format");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Minimum length for a valid encrypted blob (iv + tag) */
export const ENCRYPTED_HEADER_LENGTH = IV_LENGTH + AUTH_TAG_LENGTH;

/**
 * Encrypt file payload for storage at rest. Returns plaintext unchanged if encryption disabled.
 */
export function encryptFilePayload(plaintext: Buffer): Buffer {
  const key = getFileDek();
  if (!key) return plaintext;
  return encrypt(key, plaintext);
}

/**
 * Decrypt file payload from disk. Returns ciphertext unchanged if not in encrypted format or encryption disabled.
 */
export function decryptFilePayload(ciphertext: Buffer): Buffer {
  const key = getFileDek();
  if (!key || ciphertext.length < ENCRYPTED_HEADER_LENGTH) return ciphertext;
  try {
    return decrypt(key, ciphertext);
  } catch {
    return ciphertext;
  }
}

/**
 * Encrypt a DB field (e.g. wrapped_key, wrapped_key_salt). Returns plaintext unchanged if encryption disabled.
 */
export function encryptDbField(plaintext: Buffer): Buffer {
  const key = getDbDek();
  if (!key) return plaintext;
  return encrypt(key, plaintext);
}

/**
 * Decrypt a DB field. Returns ciphertext unchanged if not in encrypted format or encryption disabled.
 */
export function decryptDbField(ciphertext: Buffer): Buffer {
  const key = getDbDek();
  if (!key || ciphertext.length < ENCRYPTED_HEADER_LENGTH) return ciphertext;
  try {
    return decrypt(key, ciphertext);
  } catch {
    return ciphertext;
  }
}

/**
 * Returns true if the buffer looks like our encrypted format (length >= header, optional version byte handled by callers).
 */
export function isEncryptedFormat(buffer: Buffer): boolean {
  return buffer.length >= ENCRYPTED_HEADER_LENGTH;
}
