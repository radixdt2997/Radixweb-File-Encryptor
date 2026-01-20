/**
 * Application Constants
 * 
 * Imports from shared crypto config to maintain single source of truth
 * for cryptographic parameters.
 */

import CRYPTO_CONFIG from '../../../shared/crypto-config.js';

// Re-export crypto config for convenience
export const {
    PBKDF2,
    AESGCM,
    FILE_FORMAT,
    VALIDATION,
} = CRYPTO_CONFIG;

// UI-specific constants
export const UI_MESSAGES = {
    ENCRYPTING: 'Encrypting file...',
    DECRYPTING: 'Decrypting file...',
    ENCRYPTION_SUCCESS: 'File encrypted successfully!',
    DECRYPTION_SUCCESS: 'File decrypted successfully!',
    ENCRYPTION_ERROR: 'Encryption failed. Please try again.',
    DECRYPTION_ERROR: 'Decryption failed. Incorrect password?',
    INVALID_PASSWORD: 'Password must be at least 8 characters long.',
    NO_FILE_SELECTED: 'Please select a file.',
    NO_PASSWORD_ENTERED: 'Please enter a password.',
    FILE_EMPTY: 'File cannot be empty.',
    CORRUPTED_FILE: 'File appears to be corrupted or invalid.',
};

// Timeouts
export const TIMEOUTS = {
    MESSAGE_DISPLAY: 5000, // 5 seconds
};
