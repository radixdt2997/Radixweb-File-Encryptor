/**
 * Binary File Format Handling
 * 
 * Packs and unpacks encrypted files in the required format:
 * [Salt: 16B][IV: 12B][Encrypted Data: variable]
 * 
 * This format must be preserved exactly for interoperability.
 */

import { FILE_FORMAT } from '../utils/constants.js';

/**
 * Pack salt, IV, and encrypted data into a single binary blob
 * 
 * Format (byte-precise):
 *   Bytes 0-15:    Salt (16 bytes)
 *   Bytes 16-27:   IV (12 bytes)
 *   Bytes 28+:     Encrypted data (variable length)
 * 
 * @param {Uint8Array} salt - 16-byte salt
 * @param {Uint8Array} iv - 12-byte initialization vector
 * @param {Uint8Array} encryptedData - Encrypted file data
 * @returns {Uint8Array} - Complete encrypted file blob
 */
export function packEncryptedFile(salt, iv, encryptedData) {
    if (salt.length !== FILE_FORMAT.SALT_LENGTH) {
        throw new Error(`Salt must be exactly ${FILE_FORMAT.SALT_LENGTH} bytes`);
    }
    if (iv.length !== FILE_FORMAT.IV_LENGTH) {
        throw new Error(`IV must be exactly ${FILE_FORMAT.IV_LENGTH} bytes`);
    }

    const totalSize = FILE_FORMAT.HEADER_SIZE + encryptedData.length;
    const packed = new Uint8Array(totalSize);

    // Write salt at offset 0
    packed.set(salt, FILE_FORMAT.SALT_OFFSET);

    // Write IV at offset 16
    packed.set(iv, FILE_FORMAT.IV_OFFSET);

    // Write encrypted data at offset 28
    packed.set(encryptedData, FILE_FORMAT.ENCRYPTED_DATA_OFFSET);

    return packed;
}

/**
 * Unpack an encrypted file blob into its components
 * 
 * @param {Uint8Array} encryptedBlob - Complete encrypted file (salt + IV + data)
 * @returns {Object} - { salt: Uint8Array, iv: Uint8Array, encryptedData: Uint8Array }
 * @throws {Error} - If blob is corrupted or too small
 */
export function unpackEncryptedFile(encryptedBlob) {
    // Validate minimum size
    if (encryptedBlob.length < FILE_FORMAT.HEADER_SIZE) {
        throw new Error(
            `Encrypted file is too small. Minimum ${FILE_FORMAT.HEADER_SIZE} bytes (header only), got ${encryptedBlob.length}`
        );
    }

    // Extract salt (bytes 0-15)
    const salt = encryptedBlob.slice(
        FILE_FORMAT.SALT_OFFSET,
        FILE_FORMAT.SALT_OFFSET + FILE_FORMAT.SALT_LENGTH
    );

    // Extract IV (bytes 16-27)
    const iv = encryptedBlob.slice(
        FILE_FORMAT.IV_OFFSET,
        FILE_FORMAT.IV_OFFSET + FILE_FORMAT.IV_LENGTH
    );

    // Extract encrypted data (bytes 28+)
    const encryptedData = encryptedBlob.slice(FILE_FORMAT.ENCRYPTED_DATA_OFFSET);

    return { salt, iv, encryptedData };
}

/**
 * PUBLIC SECURITY NOTES:
 * - Format is strictly byte-ordered for consistency
 * - No padding or markers; just sequential concatenation
 * - Validation ensures corrupted files are detected early
 * - Uint8Array operations create new buffers (no reference sharing)
 */
