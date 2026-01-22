/**
 * PBKDF2 Key Derivation
 * 
 * Derives a cryptographic key from a user password using PBKDF2.
 * This ensures weak passwords are strengthened against brute-force attacks.
 */

import { PBKDF2, AESGCM } from '../utils/constants.js';

/**
 * Derive a 256-bit key from a password using PBKDF2-SHA256
 * 
 * @param {string} password - User's password (plaintext)
 * @param {Uint8Array} salt - Random salt (16 bytes)
 * @returns {Promise<CryptoKey>} - Web Crypto CryptoKey ready for AES-GCM
 * @throws {Error} - If derivation fails
 */
export async function deriveKey(password, salt) {
    // Convert password string to UTF-8 bytes
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as raw key material for PBKDF2
    const baseKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false, // extractable: false (key stays in browser)
        ['deriveBits', 'deriveKey']
    );

    // Derive the final key using PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            hash: PBKDF2.hash,
            salt: salt,
            iterations: PBKDF2.iterations,
        },
        baseKey,
        {
            name: AESGCM.algorithm,
            length: AESGCM.keyLength,
        },
        false, // extractable: false (key stays in browser)
        ['encrypt', 'decrypt']
    );

    return derivedKey;
}

/**
 * Generate a random salt for key derivation
 *
 * @returns {Uint8Array} - Random 16-byte salt
 */
export function generateSalt() {
    const salt = new Uint8Array(PBKDF2.saltLength);
    crypto.getRandomValues(salt);
    return salt;
}

/**
 * Generate a random AES-GCM key for direct encryption
 *
 * Used for Phase 2 key-based encryption where we generate
 * a random key first, then encrypt with that key.
 *
 * @returns {Promise<CryptoKey>} - Random AES-GCM key
 * @throws {Error} - If key generation fails
 */
export async function generateRandomKey() {
    try {
        const key = await crypto.subtle.generateKey(
            {
                name: AESGCM.algorithm,
                length: AESGCM.keyLength,
            },
            true, // extractable: true (needed for key wrapping)
            ['encrypt', 'decrypt']
        );

        return key;
    } catch (error) {
        throw new Error(`Key generation failed: ${error.message}`);
    }
}

/**
 * PUBLIC SECURITY NOTES:
 * - Password is never stored; only used to derive key
 * - 250k iterations (PBKDF2.iterations) makes brute-force attack slow
 * - Salt is random per encryption, preventing rainbow table attacks
 * - Derived key never leaves browser and is not extractable
 * - Key is automatically destroyed by GC after use
 */
