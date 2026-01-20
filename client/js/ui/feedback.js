/**
 * Feedback Display Utilities
 * 
 * Shows messages to user (errors, success, info).
 * Handles message timing and styling.
 */

import * as DOM from './dom.js';
import { TIMEOUTS, UI_MESSAGES } from '../utils/constants.js';

let messageTimeoutId = null;

/**
 * Display a message to the user
 * 
 * @param {string} message - Message text to display
 * @param {'error'|'success'|'info'} type - Message type (determines styling)
 * @param {number} duration - Display duration in ms (default: auto-dismiss)
 */
export function showMessage(message, type = 'info', duration = TIMEOUTS.MESSAGE_DISPLAY) {
    const msgArea = DOM.messageArea();
    const msgText = DOM.messageText();

    if (!msgArea || !msgText) {
        console.warn('Message area not ready');
        return;
    }

    // Clear any pending auto-dismiss
    if (messageTimeoutId) {
        clearTimeout(messageTimeoutId);
        messageTimeoutId = null;
    }

    // Set message content and styling
    msgText.textContent = message;
    msgArea.classList.remove('error', 'success', 'info');
    msgArea.classList.add(type);
    msgArea.style.display = 'block';

    // Auto-dismiss after duration (if duration > 0)
    if (duration > 0) {
        messageTimeoutId = setTimeout(() => {
            hideMessage();
            messageTimeoutId = null;
        }, duration);
    }
}

/**
 * Hide the message area
 */
export function hideMessage() {
    const msgArea = DOM.messageArea();
    if (msgArea) {
        msgArea.style.display = 'none';
        msgArea.classList.remove('error', 'success', 'info');
    }
}

/**
 * Show error message
 * 
 * @param {string} errorMessage - Error text
 * @param {number} duration - Display duration in ms
 */
export function showError(errorMessage, duration = TIMEOUTS.MESSAGE_DISPLAY) {
    showMessage(errorMessage, 'error', duration);
}

/**
 * Show success message
 * 
 * @param {string} successMessage - Success text
 * @param {number} duration - Display duration in ms
 */
export function showSuccess(successMessage, duration = TIMEOUTS.MESSAGE_DISPLAY) {
    showMessage(successMessage, 'success', duration);
}

/**
 * Show info message
 * 
 * @param {string} infoMessage - Info text
 * @param {number} duration - Display duration in ms
 */
export function showInfo(infoMessage, duration = TIMEOUTS.MESSAGE_DISPLAY) {
    showMessage(infoMessage, 'info', duration);
}

/**
 * SECURITY NOTE:
 * - No sensitive data (passwords, keys, decrypted content) is logged
 * - Error messages are generic for encryption failures
 * - User-facing messages do not expose internal error details
 */
