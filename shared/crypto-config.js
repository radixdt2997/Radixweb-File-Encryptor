/**
 * MEMORY BANK: Cryptographic Configuration
 * 
 * This is the single source of truth for all encryption parameters.
 * Every crypto module must import from here to prevent parameter drift
 * and accidental security regressions.
 * 
 * CRITICAL: Do not modify values without understanding security implications.
 */

export const CRYPTO_CONFIG = {
    // PBKDF2 Key Derivation Parameters
    PBKDF2: {
        iterations: 250000,    // Minimum required by spec
        hash: 'SHA-256',       // Hash algorithm for PBKDF2
        saltLength: 16,        // 16 bytes of random salt
    },

    // AES-GCM Encryption Parameters
    AESGCM: {
        algorithm: 'AES-GCM',
        keyLength: 256,        // 256-bit key (32 bytes)
        ivLength: 12,          // 12 bytes IV for GCM (96 bits is standard for performance)
    },

    // Binary File Format Structure (byte-precise)
    FILE_FORMAT: {
        SALT_OFFSET: 0,        // Bytes 0-15: Salt
        SALT_LENGTH: 16,
        IV_OFFSET: 16,         // Bytes 16-27: IV
        IV_LENGTH: 12,
        ENCRYPTED_DATA_OFFSET: 28, // Bytes 28+: Encrypted data
        HEADER_SIZE: 28,       // Total header: salt (16) + IV (12)
    },

    // Validation
    VALIDATION: {
        MIN_PASSWORD_LENGTH: 8,
        MIN_FILE_SIZE: 1,      // At least 1 byte
    },
};

/**
 * SECURITY NOTES:
 * 
 * - PBKDF2 with 250k iterations ensures strong key derivation from weak passwords
 * - 12-byte IV for AES-GCM is standard; never reuse IV with same key
 * - 16-byte salt provides 2^128 uniqueness against rainbow tables
 * - File format is strictly sequential: salt → IV → ciphertext
 *   This order is critical for pack/unpack operations
 * - All numeric values are in bytes (8 bits)
 */

export default CRYPTO_CONFIG;
