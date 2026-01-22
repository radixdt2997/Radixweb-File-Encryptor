/**
 * UI State Management
 * 
 * Controls button disabled states, loading indicators, and visibility.
 * Prevents user interaction during crypto operations.
 */

import * as DOM from './dom.js';

/**
 * Set all action buttons to disabled state
 * Shows processing indicator.
 */
export function setProcessing() {
    DOM.encryptButton().disabled = true;
    DOM.decryptButton().disabled = true;
    DOM.fileInput().disabled = true;
    DOM.passwordInput().disabled = true;

    const status = DOM.statusIndicator();
    if (status) {
        status.classList.add('loading');
    }
}

/**
 * Set all action buttons to enabled state
 * Hides processing indicator.
 */
export function setReady() {
    DOM.encryptButton().disabled = false;
    DOM.decryptButton().disabled = false;
    DOM.fileInput().disabled = false;
    DOM.passwordInput().disabled = false;

    const status = DOM.statusIndicator();
    if (status) {
        status.classList.remove('loading');
    }
}

/**
 * Clear the password input field
 * 
 * Sensitive data is cleared from memory.
 */
export function clearPasswordInput() {
    const input = DOM.passwordInput();
    if (input) {
        input.value = '';
    }
}

/**
 * Clear the file input field
 */
export function clearFileInput() {
    const input = DOM.fileInput();
    if (input) {
        input.value = '';
    }
}

/**
 * Clear both inputs and message area
 */
export function clearAll() {
    clearPasswordInput();
    clearFileInput();
    clearMessageArea();
}

/**
 * Clear message display area
 */
export function clearMessageArea() {
    const msgText = DOM.messageText();
    if (msgText) {
        msgText.textContent = '';
    }

    const msgArea = DOM.messageArea();
    if (msgArea) {
        msgArea.classList.remove('error', 'success', 'info');
        msgArea.style.display = 'none';
    }
}

/**
 * Disable all sender mode buttons during processing
 */
export function disableAllButtons() {
    const buttons = [
        'sender-encrypt-btn',
        'sender-upload-btn',
        'sender-reset-btn'
    ];

    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = true;
        }
    });
}

/**
 * Enable all sender mode buttons after processing
 */
export function enableAllButtons() {
    const buttons = [
        'sender-encrypt-btn',
        'sender-upload-btn',
        'sender-reset-btn'
    ];

    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = false;
        }
    });
}

/**
 * Set loading state for a specific button
 * @param {string} buttonId - ID of the button
 * @param {boolean} loading - Whether to show loading state
 */
export function setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = loading;
        if (loading) {
            button.textContent = button.textContent.replace(/^[^\s]+/, '⏳');
        } else {
            // Reset to original text (this is a simple approach)
            button.textContent = button.textContent.replace('⏳', getOriginalButtonText(buttonId));
        }
    }
}

/**
 * Get original button text for a given button ID
 * @param {string} buttonId - ID of the button
 * @returns {string} Original button text
 */
function getOriginalButtonText(buttonId) {
    const textMap = {
        'sender-encrypt-btn': '🔒 Encrypt File',
        'sender-upload-btn': '☁️ Upload & Share',
        'sender-reset-btn': 'Reset',
        'verify-otp-btn': 'Verify OTP',
        'download-btn': 'Download File'
    };
    return textMap[buttonId] || '';
}
