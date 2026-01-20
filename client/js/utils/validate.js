/**
 * Input Validation Utilities
 * 
 * Validates user input (password, file) before encryption/decryption.
 * Does not mutate or trim inputs.
 */

import { VALIDATION, UI_MESSAGES } from './constants.js';

/**
 * Validate password according to spec
 * 
 * Rules:
 *   - Minimum 8 characters
 *   - Not empty
 *   - Not trimmed (original input preserved)
 * 
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validatePassword(password) {
    if (typeof password !== 'string') {
        return { valid: false, error: UI_MESSAGES.NO_PASSWORD_ENTERED };
    }

    if (password.length === 0) {
        return { valid: false, error: UI_MESSAGES.NO_PASSWORD_ENTERED };
    }

    if (password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
        return { valid: false, error: UI_MESSAGES.INVALID_PASSWORD };
    }

    return { valid: true, error: null };
}

/**
 * Validate file before encryption/decryption
 * 
 * Rules:
 *   - File must be selected
 *   - File must have non-zero size
 * 
 * @param {File} file - File object from input
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateFile(file) {
    if (!file) {
        return { valid: false, error: UI_MESSAGES.NO_FILE_SELECTED };
    }

    if (!(file instanceof File)) {
        return { valid: false, error: UI_MESSAGES.NO_FILE_SELECTED };
    }

    if (file.size === 0) {
        return { valid: false, error: UI_MESSAGES.FILE_EMPTY };
    }

    return { valid: true, error: null };
}

/**
 * Validate form inputs before encryption
 * 
 * @param {File} file - File to encrypt
 * @param {string} password - Password
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateEncryptionInput(file, password) {
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
        return fileValidation;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return passwordValidation;
    }

    return { valid: true, error: null };
}

/**
 * Validate form inputs before decryption
 * 
 * @param {File} file - Encrypted file
 * @param {string} password - Password
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateDecryptionInput(file, password) {
    // Same validation as encryption
    return validateEncryptionInput(file, password);
}
