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
