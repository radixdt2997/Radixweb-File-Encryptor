/**
 * Cryptographic utilities for file encryption
 * Uses Web Crypto API with AES-GCM and PBKDF2
 */

interface WrappedKeyResult {
  wrappedKey: Uint8Array;
  salt: Uint8Array;
}

export const crypto = {
  /**
   * Encrypt data with AES-GCM key
   * Format: [IV: 12 bytes][Encrypted Data: variable]
   */
  async encryptWithKey(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data as BufferSource,
    );
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
  },

  /**
   * Decrypt data with AES-GCM key
   * Expects format: [IV: 12 bytes][Encrypted Data: variable]
   */
  async decryptWithKey(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted,
    );
    return new Uint8Array(decrypted);
  },

  /**
   * Encrypt data with password using PBKDF2 + AES-GCM
   * Format: [Salt: 16 bytes][IV: 12 bytes][Encrypted Data: variable]
   */
  async encryptWithPassword(
    data: Uint8Array,
    password: string,
  ): Promise<Uint8Array> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const key = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 250000,
        hash: "SHA-256",
      },
      key,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );

    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      derivedKey,
      data as BufferSource,
    );

    const result = new Uint8Array(
      salt.length + iv.length + encrypted.byteLength,
    );
    result.set(salt);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    return result;
  },

  /**
   * Decrypt data encrypted with password
   * Expects format: [Salt: 16 bytes][IV: 12 bytes][Encrypted Data: variable]
   */
  async decryptWithPassword(
    data: Uint8Array,
    password: string,
  ): Promise<Uint8Array> {
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);

    const key = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 250000,
        hash: "SHA-256",
      },
      key,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      derivedKey,
      encrypted,
    );
    return new Uint8Array(decrypted);
  },

  /** Generate a new AES-256-GCM encryption key */
  async generateKey(): Promise<CryptoKey> {
    return window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  },

  /**
   * Wrap encryption key with OTP-derived key
   * Returns wrapped key and unique salt for PBKDF2
   */
  async wrapKey(fileKey: CryptoKey, otp: string): Promise<WrappedKeyResult> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const otpKey = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(otp),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    const wrappingKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations: 250000,
        hash: "SHA-256",
      },
      otpKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );

    const keyData = await window.crypto.subtle.exportKey("raw", fileKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrappingKey,
      keyData,
    );

    const result = new Uint8Array(iv.length + wrapped.byteLength);
    result.set(iv);
    result.set(new Uint8Array(wrapped), iv.length);

    return { wrappedKey: result, salt };
  },

  /**
   * Unwrap encryption key using OTP
   * Format: [IV: 12 bytes][Wrapped Key: variable]
   */
  async unwrapKey(
    wrappedKey: Uint8Array,
    salt: Uint8Array,
    otp: string,
  ): Promise<CryptoKey> {
    const iv = wrappedKey.slice(0, 12);
    const encrypted = wrappedKey.slice(12);

    const otpKey = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(otp),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    const unwrappingKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations: 250000,
        hash: "SHA-256",
      },
      otpKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );

    const keyData = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      unwrappingKey,
      encrypted,
    );

    return window.crypto.subtle.importKey("raw", keyData, "AES-GCM", true, [
      "encrypt",
      "decrypt",
    ]);
  },

  /** Hash OTP with SHA-256 for storage */
  async hashOTP(otp: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode(...hashArray));
  },
};
