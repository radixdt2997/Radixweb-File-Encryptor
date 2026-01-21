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

// Phase 2: OTP and Key Wrapping Constants
export const OTP_CONFIG = {
    LENGTH: 6,                      // 6-digit OTP
    EXPIRY_MINUTES: 5,              // OTP expires after 5 minutes
    MAX_ATTEMPTS: 3,                // Maximum verification attempts
    RESEND_COOLDOWN_SECONDS: 30,    // Cooldown between OTP requests
};

export const FILE_DELIVERY_CONFIG = {
    DEFAULT_EXPIRY_MINUTES: 60,     // Default file expiry: 1 hour
    MAX_EXPIRY_MINUTES: 1440,       // Maximum expiry: 24 hours
    EXPIRY_TYPES: ['one-time', 'time-based'],
    MAX_FILE_SIZE_MB: 100,
};

// API Configuration
// In browser, we can't use process.env, so we default to localhost
export const API_CONFIG = {
    BASE_URL: 'http://localhost:3000/api',
    TIMEOUT_MS: 30000,
};

// Timeouts
export const TIMEOUTS = {
    MESSAGE_DISPLAY: 5000, // 5 seconds
    OTP_EXPIRY_WARNING: 60000, // 1 minute before expiry, show warning
};
