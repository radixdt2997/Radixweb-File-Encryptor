/**
 * Sender Page
 * 
 * Allows a user to:
 * 1. Select and encrypt a file
 * 2. Specify recipient email
 * 3. Set expiry rules (one-time or time-based)
 * 4. Upload to server
 * 5. Share the download link and OTP
 * 
 * All encryption happens in the browser.
 * The server never sees the plaintext file or fileKey.
 */

import { generateRandomKey } from '../crypto/key.js';
import { encrypt } from '../crypto/crypto.js';
import {
    generateOTP,
    wrapFileKey,
    hashOTP
} from '../crypto/wrapping.js';
import { uploadFile } from '../utils/api.js';
import { showSuccess, showError, showInfo } from '../ui/feedback.js';
import { setButtonLoading, disableAllButtons, enableAllButtons } from '../ui/state.js';

let currentFile = null;
let currentFileKey = null;

/**
 * Initialize sender page event listeners
 */
export function initSenderPage() {
    const senderForm = document.getElementById('sender-form');
    const fileInput = document.getElementById('sender-file-input');
    const recipientEmail = document.getElementById('sender-recipient-email');
    const expiryMinutes = document.getElementById('sender-expiry-minutes');
    const expiryType = document.getElementById('sender-expiry-type');
    const encryptButton = document.getElementById('sender-encrypt-btn');
    const uploadButton = document.getElementById('sender-upload-btn');
    const resultSection = document.getElementById('sender-result');
    const resultOTP = document.getElementById('result-otp');
    const resultLink = document.getElementById('result-link');
    const copyLinkButton = document.getElementById('copy-link-btn');
    const copyOTPButton = document.getElementById('copy-otp-btn');
    const resetButton = document.getElementById('sender-reset-btn');

    // Prevent form submission on any button click
    senderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        return false;
    });

    // File selection
    fileInput.addEventListener('change', (e) => {
        currentFile = e.target.files[0];
        if (currentFile) {
            showInfo(`Selected: ${currentFile.name}`);
            encryptButton.disabled = false;
        }
    });

    // Encrypt file
    encryptButton.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!currentFile) {
            showError('Please select a file first');
            return;
        }

        await encryptFile(currentFile);
    });

    // Upload encrypted file
    uploadButton.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!currentFile || !currentFileKey) {
            showError('Please encrypt a file first');
            return;
        }

        const email = recipientEmail.value.trim();
        if (!email || !email.includes('@')) {
            showError('Please enter a valid recipient email');
            return;
        }

        await uploadEncryptedFile(email, expiryMinutes.value, expiryType.value);
    });

    // Copy functions
    copyLinkButton.addEventListener('click', (e) => {
        e.preventDefault();
        const link = resultLink.textContent;
        navigator.clipboard.writeText(link).then(() => {
            showSuccess('Link copied to clipboard!');
        });
    });

    copyOTPButton.addEventListener('click', (e) => {
        e.preventDefault();
        const otp = resultOTP.textContent;
        navigator.clipboard.writeText(otp).then(() => {
            showSuccess('OTP copied to clipboard!');
        });
    });

    // Reset
    resetButton.addEventListener('click', (e) => {
        e.preventDefault();
        resetSenderForm();
    });
}

/**
 * Encrypt file in the browser
 * 
 * @param {File} file - File to encrypt
 */
async function encryptFile(file) {
    try {
        setButtonLoading('sender-encrypt-btn', true);
        showInfo('Encrypting file...');

        // Read file as ArrayBuffer
        const fileBuffer = await file.arrayBuffer();
        const fileData = new Uint8Array(fileBuffer);

        // Generate random fileKey (AES-256)
        currentFileKey = await generateRandomKey();

        // Encrypt file with fileKey
        const encryptedData = await encrypt(fileData, currentFileKey);

        showSuccess(`File encrypted: ${(encryptedData.length / 1024).toFixed(2)} KB`);

        // Enable upload button
        document.getElementById('sender-upload-btn').disabled = false;
        document.getElementById('sender-recipient-email').disabled = false;
        document.getElementById('sender-expiry-minutes').disabled = false;
        document.getElementById('sender-expiry-type').disabled = false;
    } catch (error) {
        showError(`Encryption error: ${error.message}`);
    } finally {
        setButtonLoading('sender-encrypt-btn', false);
    }
}

/**
 * Upload encrypted file to server
 * 
 * @param {string} recipientEmail - Email of recipient
 * @param {number} expiryMinutes - Expiry time
 * @param {string} expiryType - 'one-time' or 'time-based'
 */
async function uploadEncryptedFile(recipientEmail, expiryMinutes, expiryType) {
    try {
        setButtonLoading('sender-upload-btn', true);
        disableAllButtons();
        showInfo('Encrypting key and uploading...');

        // Generate OTP (6 digits)
        const otp = generateOTP();

        // Wrap fileKey with OTP
        const { wrappedKeyData, salt } = await wrapFileKey(currentFileKey, otp);

        // Hash OTP for server storage
        const otpHash = await hashOTP(otp);

        // Get encrypted file data
        const fileBuffer = await currentFile.arrayBuffer();
        const fileData = new Uint8Array(fileBuffer);
        const encryptedData = await encrypt(fileData, currentFileKey);

        // Upload to server
        const response = await uploadFile({
            fileName: currentFile.name,
            encryptedData,
            wrappedKey: wrappedKeyData,
            wrappedKeySalt: salt,
            recipientEmail,
            otpHash,
            expiryMinutes: parseInt(expiryMinutes),
            expiryType
        });

        // Show result
        showResult(otp, response.downloadUrl, response.fileId);
        showSuccess('File uploaded successfully!');
    } catch (error) {
        showError(`Upload error: ${error.message}`);
        enableAllButtons();
    } finally {
        setButtonLoading('sender-upload-btn', false);
    }
}

/**
 * Display upload result (link and OTP)
 */
function showResult(otp, downloadUrl, fileId) {
    const resultSection = document.getElementById('sender-result');
    const resultOTP = document.getElementById('result-otp');
    const resultLink = document.getElementById('result-link');

    resultOTP.textContent = otp;
    resultLink.textContent = downloadUrl;
    resultSection.style.display = 'block';

    // Auto-scroll to result
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Reset sender form
 */
function resetSenderForm() {
    document.getElementById('sender-file-input').value = '';
    document.getElementById('sender-recipient-email').value = '';
    document.getElementById('sender-expiry-minutes').value = '60';
    document.getElementById('sender-expiry-type').value = 'time-based';
    document.getElementById('sender-encrypt-btn').disabled = true;
    document.getElementById('sender-upload-btn').disabled = true;
    document.getElementById('sender-recipient-email').disabled = true;
    document.getElementById('sender-expiry-minutes').disabled = true;
    document.getElementById('sender-expiry-type').disabled = true;
    document.getElementById('sender-result').style.display = 'none';

    currentFile = null;
    currentFileKey = null;

    showInfo('Form reset');
}

export { currentFile, currentFileKey };
