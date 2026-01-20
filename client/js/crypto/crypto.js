/**
 * AES-GCM Encryption and Decryption
 * 
 * Handles symmetric encryption/decryption using the Web Crypto API.
 * AES-GCM provides both confidentiality and authenticity.
 */

import { AESGCM, FILE_FORMAT } from '../utils/constants.js';
import { deriveKey, generateSalt } from './key.js';
import { packEncryptedFile, unpackEncryptedFile } from './file.js';

/**
 * Encrypt file data with a password
 * 
 * Process:
 *   1. Generate random salt and IV
 *   2. Derive key from password + salt
 *   3. Encrypt file data using AES-GCM
 *   4. Pack salt + IV + ciphertext into binary blob
 * 
 * @param {Uint8Array} fileData - Original file data to encrypt
 * @param {string} password - User's password
 * @returns {Promise<Uint8Array>} - Complete encrypted file blob (salt + IV + ciphertext)
 * @throws {Error} - If encryption fails
 */
export async function encryptFile(fileData, password) {
    try {
        // 1. Generate random salt and IV
        const salt = generateSalt();
        const iv = crypto.getRandomValues(new Uint8Array(AESGCM.ivLength));

        // 2. Derive encryption key from password
        const key = await deriveKey(password, salt);

        // 3. Encrypt file data using AES-GCM
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: AESGCM.algorithm,
                iv: iv,
            },
            key,
            fileData
        );

        // Convert ciphertext to Uint8Array
        const ciphertextArray = new Uint8Array(ciphertext);

        // 4. Pack salt + IV + ciphertext into single blob
        const encryptedBlob = packEncryptedFile(salt, iv, ciphertextArray);

        return encryptedBlob;
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypt an encrypted file blob with a password
 * 
 * Process:
 *   1. Unpack blob into salt, IV, ciphertext
 *   2. Derive key from password + salt
 *   3. Decrypt ciphertext using AES-GCM
 *   4. Return decrypted file data
 * 
 * @param {Uint8Array} encryptedBlob - Complete encrypted file (salt + IV + ciphertext)
 * @param {string} password - User's password
 * @returns {Promise<Uint8Array>} - Decrypted file data
 * @throws {Error} - If decryption fails (wrong password, corrupted data, etc.)
 */
export async function decryptFile(encryptedBlob, password) {
    try {
        // 1. Unpack blob into components
        const { salt, iv, encryptedData } = unpackEncryptedFile(encryptedBlob);

        // 2. Derive key from password + salt
        const key = await deriveKey(password, salt);

        // 3. Decrypt ciphertext using AES-GCM
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: AESGCM.algorithm,
                iv: iv,
            },
            key,
            encryptedData
        );

        // 4. Convert to Uint8Array
        const decryptedData = new Uint8Array(decryptedBuffer);

        return decryptedData;
    } catch (error) {
        // GCM authentication failure or decryption error
        if (error.name === 'OperationError') {
            throw new Error('Decryption failed: Invalid password or corrupted file');
        }
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

/**
 * PUBLIC SECURITY NOTES:
 * 
 * - AES-GCM provides authenticated encryption (AEAD)
 *   - Confidentiality: 256-bit AES encryption
 *   - Authenticity: GCM authentication tag prevents tampering
 * 
 * - Random salt per encryption prevents rainbow table attacks
 * - Random IV per encryption prevents key-IV pair reuse
 * - 12-byte IV (96 bits) is standard for GCM performance
 * - Derived keys never leave browser and are not extractable
 * - Wrong password results in GCM authentication failure (OperationError)
 * - Sensitive data (keys, passwords) are not logged
 */
