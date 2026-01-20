/**
 * Main Application Entry Point
 * 
 * Orchestrates all encryption and decryption operations.
 * Handles event listeners, validation, crypto calls, and UI updates.
 * 
 * Security Rules:
 * - Never logs passwords or sensitive data
 * - Crypto module handles all encryption logic
 * - UI module handles all display logic
 * - No mixing of concerns
 */

import { encryptFile, decryptFile } from './crypto/crypto.js';
import {
    validateEncryptionInput,
    validateDecryptionInput,
} from './utils/validate.js';
import { downloadFile, getEncryptedFilename, getDecryptedFilename } from './utils/download.js';
import * as DOM from './ui/dom.js';
import * as State from './ui/state.js';
import * as Feedback from './ui/feedback.js';
import { UI_MESSAGES } from './utils/constants.js';

/**
 * Initialize application
 * Attach event listeners to all buttons
 */
function init() {
    // Verify DOM is ready
    if (!DOM.ensureDOMReady()) {
        console.error('DOM initialization failed. Required elements are missing.');
        return;
    }

    // Attach event listeners
    DOM.encryptButton().addEventListener('click', handleEncrypt);
    DOM.decryptButton().addEventListener('click', handleDecrypt);
    DOM.clearButton().addEventListener('click', handleClear);

    // Initialize UI state
    State.setReady();

    console.log('Application initialized');
}

/**
 * Handle encryption button click
 * 
 * Flow:
 *   1. Get file and password from inputs
 *   2. Validate inputs
 *   3. Read file as bytes
 *   4. Call crypto.encryptFile()
 *   5. Download encrypted file
 *   6. Show success message
 */
async function handleEncrypt() {
    try {
        // Get inputs
        const file = DOM.fileInput().files[0];
        const password = DOM.passwordInput().value;

        // Validate
        const validation = validateEncryptionInput(file, password);
        if (!validation.valid) {
            Feedback.showError(validation.error);
            return;
        }

        // Show processing state
        State.setProcessing();
        Feedback.showInfo(UI_MESSAGES.ENCRYPTING, 0); // No auto-dismiss during processing

        // Read file as Uint8Array
        const fileData = await readFileAsArrayBuffer(file);

        // Encrypt
        const encryptedBlob = await encryptFile(fileData, password);

        // Download
        const encryptedFilename = getEncryptedFilename(file.name);
        downloadFile(encryptedBlob, encryptedFilename);

        // Show success
        State.setReady();
        Feedback.showSuccess(UI_MESSAGES.ENCRYPTION_SUCCESS);
    } catch (error) {
        console.error('Encryption error:', error);
        State.setReady();
        Feedback.showError(UI_MESSAGES.ENCRYPTION_ERROR);
    }
}

/**
 * Handle decryption button click
 * 
 * Flow:
 *   1. Get file and password from inputs
 *   2. Validate inputs
 *   3. Read file as bytes
 *   4. Call crypto.decryptFile()
 *   5. Download decrypted file
 *   6. Show success message
 */
async function handleDecrypt() {
    try {
        // Get inputs
        const file = DOM.fileInput().files[0];
        const password = DOM.passwordInput().value;

        // Validate
        const validation = validateDecryptionInput(file, password);
        if (!validation.valid) {
            Feedback.showError(validation.error);
            return;
        }

        // Show processing state
        State.setProcessing();
        Feedback.showInfo(UI_MESSAGES.DECRYPTING, 0); // No auto-dismiss during processing

        // Read file as Uint8Array
        const encryptedData = await readFileAsArrayBuffer(file);

        // Decrypt
        const decryptedData = await decryptFile(encryptedData, password);

        // Download
        const decryptedFilename = getDecryptedFilename(file.name);
        downloadFile(decryptedData, decryptedFilename);

        // Show success
        State.setReady();
        Feedback.showSuccess(UI_MESSAGES.DECRYPTION_SUCCESS);
    } catch (error) {
        console.error('Decryption error:', error);
        State.setReady();
        Feedback.showError(UI_MESSAGES.DECRYPTION_ERROR);
    }
}

/**
 * Handle clear button click
 * Clears all inputs and messages
 */
function handleClear() {
    State.clearAll();
}

/**
 * Read file into Uint8Array buffer
 * 
 * @param {File} file - File object from input
 * @returns {Promise<Uint8Array>} - File contents as bytes
 * @throws {Error} - If read fails
 */
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const buffer = event.target.result;
            const array = new Uint8Array(buffer);
            resolve(array);
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

/**
 * SECURITY NOTES:
 * 
 * - No global variables; all state is managed through modules
 * - Passwords are never logged
 * - Error messages are user-friendly but non-specific
 * - All crypto operations are delegated to crypto/ modules
 * - All UI operations are delegated to ui/ modules
 * - No sensitive data is ever sent to server
 * - File reading happens entirely in browser
 */
