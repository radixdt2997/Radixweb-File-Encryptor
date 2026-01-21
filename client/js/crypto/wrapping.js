/**
 * Key Wrapping System
 * 
 * Encrypts the fileKey using an OTP-derived key.
 * This allows passwordless delivery: the fileKey is never exposed,
 * only wrapped and stored on the server.
 * 
 * Security Model:
 * - fileKey: Random AES-256 key (256 bits / 32 bytes)
 * - OTP: 6-digit numeric code (derived via PBKDF2)
 * - otpKey: Derived from OTP using PBKDF2
 * - wrappedKey: fileKey encrypted using otpKey with AES-GCM
 * 
 * The server stores wrappedKey + otpHash, but cannot decrypt
 * without the OTP. The recipient decrypts wrappedKey in the browser
 * by deriving otpKey from the OTP they received.
 */

import { generateSalt } from './key.js';

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP (e.g., "123456")
 */
export function generateOTP() {
    const otp = Math.floor(Math.random() * 1000000);
    return String(otp).padStart(6, '0');
}

/**
 * Derive an OTP key from a plaintext OTP
 * Uses PBKDF2 with a standard salt for OTP derivation.
 * 
 * This ensures:
 * - OTP "123456" always produces the same otpKey
 * - Different OTPs produce different keys
 * - The derivation is slow (PBKDF2 iterations)
 * 
 * @param {string} otp - 6-digit OTP (e.g., "123456")
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} AES-256 key derived from OTP
 */
export async function deriveOTPKey(otp, salt) {
    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP: must be 6 digits');
    }

    const encoder = new TextEncoder();
    const otpBytes = encoder.encode(otp);

    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        otpBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            hash: 'SHA-256',
            iterations: 250000
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Wrap a file key (encrypt it using an OTP-derived key)
 * 
 * Process:
 * 1. Generate a salt for OTP key derivation
 * 2. Derive otpKey from OTP + salt
 * 3. Encrypt fileKey using otpKey
 * 4. Return wrappedKey (binary format) and salt
 * 
 * The returned wrappedKey can be sent to the server without
 * exposing the fileKey or OTP.
 * 
 * @param {CryptoKey} fileKey - The file encryption key to wrap
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<{wrappedKeyData: Uint8Array, salt: Uint8Array}>}
 *   wrappedKeyData: encrypted fileKey (can be stored/transmitted)
 *   salt: salt used for OTP key derivation (needed for unwrapping)
 */
export async function wrapFileKey(fileKey, otp) {
    if (!fileKey || typeof fileKey !== 'object') {
        throw new Error('Invalid fileKey: must be a CryptoKey');
    }
    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP: must be 6 digits');
    }

    // Generate a fresh salt for this wrapping
    const salt = generateSalt();

    // Derive otpKey from OTP + salt
    const otpKey = await deriveOTPKey(otp, salt);

    // Export fileKey to raw bytes (32 bytes for AES-256)
    const fileKeyRaw = await window.crypto.subtle.exportKey('raw', fileKey);

    // Encrypt the raw fileKey using otpKey with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const wrappedKeyEncrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        otpKey,
        new Uint8Array(fileKeyRaw)
    );

    // Pack IV + encrypted data together (IV needed for decryption)
    const wrappedKeyData = new Uint8Array(iv.length + wrappedKeyEncrypted.byteLength);
    wrappedKeyData.set(iv, 0);
    wrappedKeyData.set(new Uint8Array(wrappedKeyEncrypted), iv.length);

    return {
        wrappedKeyData,
        salt
    };
}

/**
 * Unwrap a file key (decrypt it using an OTP-derived key)
 * 
 * Process:
 * 1. Derive otpKey from OTP + salt
 * 2. Decrypt wrappedKeyData using otpKey
 * 3. Import the raw bytes back as a CryptoKey
 * 4. Return the fileKey
 * 
 * @param {Uint8Array} wrappedKeyData - Encrypted fileKey (from server)
 * @param {Uint8Array} salt - Salt used in wrapping (from server)
 * @param {string} otp - 6-digit OTP (user enters this)
 * @returns {Promise<CryptoKey>} The unwrapped file key
 * @throws {Error} If OTP is incorrect or wrappedKey is corrupted
 */
export async function unwrapFileKey(wrappedKeyData, salt, otp) {
    if (!(wrappedKeyData instanceof Uint8Array)) {
        throw new Error('Invalid wrappedKeyData: must be Uint8Array');
    }
    if (!(salt instanceof Uint8Array)) {
        throw new Error('Invalid salt: must be Uint8Array');
    }
    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP: must be 6 digits');
    }

    try {
        // Derive otpKey from OTP + salt
        const otpKey = await deriveOTPKey(otp, salt);

        // Extract IV and encrypted data (IV stored first, 12 bytes)
        const iv = wrappedKeyData.slice(0, 12);
        const encryptedData = wrappedKeyData.slice(12);

        // Decrypt wrappedKeyData using otpKey
        const fileKeyRaw = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            otpKey,
            encryptedData
        );

        // Import raw bytes back as AES-256 CryptoKey
        const fileKey = await window.crypto.subtle.importKey(
            'raw',
            fileKeyRaw,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        return fileKey;
    } catch (error) {
        // GCM authentication failure or derivation error
        throw new Error('Failed to unwrap key: incorrect OTP or corrupted key');
    }
}

/**
 * Hash an OTP for server storage
 * The server stores otpHash + compares it against recipient input.
 * This prevents the OTP from being stored in plaintext.
 * 
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<string>} Base64-encoded SHA-256 hash of OTP
 */
export async function hashOTP(otp) {
    if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP: must be 6 digits');
    }

    const encoder = new TextEncoder();
    const otpBytes = encoder.encode(otp);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', otpBytes);
    const hashArray = new Uint8Array(hashBuffer);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...hashArray));
}

/**
 * Verify an OTP against a stored hash
 * Compares a plaintext OTP against the stored hash to validate it.
 * 
 * @param {string} otp - 6-digit OTP to verify
 * @param {string} storedHash - Base64-encoded hash from server
 * @returns {Promise<boolean>} true if OTP matches hash, false otherwise
 */
export async function verifyOTPHash(otp, storedHash) {
    const computedHash = await hashOTP(otp);
    return computedHash === storedHash;
}
