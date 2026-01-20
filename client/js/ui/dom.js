/**
 * DOM Utilities
 * 
 * Provides centralized access to DOM elements.
 * All DOM queries defined here for easy auditing.
 */

// File and password inputs
export const fileInput = () => document.getElementById('file-input');
export const passwordInput = () => document.getElementById('password-input');

// Buttons
export const encryptButton = () => document.getElementById('encrypt-btn');
export const decryptButton = () => document.getElementById('decrypt-btn');
export const clearButton = () => document.getElementById('clear-btn');

// Display areas
export const messageArea = () => document.getElementById('message-area');
export const messageText = () => document.getElementById('message-text');

// Status indicator
export const statusIndicator = () => document.getElementById('status-indicator');

/**
 * Check if all required DOM elements exist
 * 
 * @returns {boolean} - true if all elements present
 */
export function ensureDOMReady() {
    const elements = [
        fileInput(),
        passwordInput(),
        encryptButton(),
        decryptButton(),
        messageArea(),
        messageText(),
    ];

    return elements.every((el) => el !== null && el !== undefined);
}
