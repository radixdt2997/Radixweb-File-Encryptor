/**
 * Recipient Page
 * 
 * Allows a recipient to:
 * 1. View file metadata from the link
 * 2. Enter the OTP they received
 * 3. Verify OTP with the server
 * 4. Decrypt the file key
 * 5. Download and decrypt the file
 * 
 * All decryption happens in the browser.
 * The server never receives the OTP in plaintext.
 */

import { decrypt } from '../crypto/crypto.js';
import { unwrapFileKey } from '../crypto/wrapping.js';
import { showError, showInfo, showSuccess } from '../ui/feedback.js';
import { setButtonLoading } from '../ui/state.js';
import { downloadFile, getFileMetadata, verifyOTP } from '../utils/api.js';
import { downloadFileToUser } from '../utils/download.js';

let currentFileId = null;
let currentWrappedKey = null;
let currentWrappedKeySalt = null;
let currentFileData = null;
let currentFileName = null;

/**
 * Initialize recipient page
 * Called when recipient visits the link with fileId
 */
export async function initRecipientPage(fileId) {
    currentFileId = fileId;

    try {
        showInfo('Loading file metadata...');
        const metadata = await getFileMetadata(fileId);

        // Display file info
        document.getElementById('file-name-display').textContent = metadata.fileName;
        document.getElementById('file-size-display').textContent =
            `${(metadata.fileSize / 1024).toFixed(2)} KB`;

        const expiryTime = new Date(metadata.expiryTime);
        document.getElementById('file-expiry-display').textContent =
            expiryTime.toLocaleString();

        showSuccess('File ready. Please enter OTP.');
    } catch (error) {
        showError(`Failed to load file: ${error.message}`);
    }
}

/**
 * Setup recipient page event listeners
 */
function setupRecipientListeners() {
    const recipientForm = document.getElementById('recipient-form');
    const otpInput = document.getElementById('recipient-otp-input');
    const verifyButton = document.getElementById('verify-otp-btn');
    const downloadButton = document.getElementById('download-btn');
    const resetButton = document.getElementById('recipient-reset-btn');

    // Prevent form submission on any button click
    recipientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        return false;
    });

    // OTP input only accepts digits
    otpInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);

        // Enable verify button only when 6 digits entered
        verifyButton.disabled = e.target.value.length !== 6;
    });

    // Verify OTP
    verifyButton.addEventListener('click', async (e) => {
        e.preventDefault();

        const otp = otpInput.value.trim();
        if (otp.length !== 6) {
            showError('OTP must be 6 digits');
            return;
        }

        await verifyAndUnwrapKey(otp);
    });

    // Download file
    downloadButton.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!currentFileData || !currentFileName) {
            showError('Please verify OTP first');
            return;
        }

        await decryptAndDownloadFile();
    });

    // Reset
    resetButton.addEventListener('click', (e) => {
        e.preventDefault();
        resetRecipientForm();
    });
}

/**
 * Verify OTP and unwrap the file key
 * 
 * @param {string} otp - 6-digit OTP
 */
async function verifyAndUnwrapKey(otp) {
    try {
        setButtonLoading('verify-otp-btn', true);
        showInfo('Verifying OTP...');

        // Call API to verify OTP and get wrapped key
        const response = await verifyOTP(currentFileId, otp);
        currentWrappedKey = response.wrappedKey;
        currentWrappedKeySalt = response.wrappedKeySalt;
        currentFileName = response.fileName;

        // Unwrap the file key using OTP
        const fileKey = await unwrapFileKey(
            currentWrappedKey,
            currentWrappedKeySalt,
            otp
        );

        // Download encrypted file
        showInfo('Downloading encrypted file...');
        currentFileData = await downloadFile(currentFileId);

        // Decrypt file
        showInfo('Decrypting file...');
        const decryptedData = await decrypt(currentFileData, fileKey);

        // Store decrypted data for download
        currentFileData = decryptedData;

        // Show download button
        document.getElementById('download-btn').disabled = false;
        showSuccess('OTP verified! File ready to download.');
    } catch (error) {
        showError(`OTP verification failed: ${error.message}`);
    } finally {
        setButtonLoading('verify-otp-btn', false);
    }
}

/**
 * Decrypt and download file
 */
async function decryptAndDownloadFile() {
    try {
        setButtonLoading('download-btn', true);
        showInfo('Preparing download...');

        // Download to user's device
        downloadFileToUser(currentFileData, currentFileName);

        showSuccess('File downloaded successfully!');
    } catch (error) {
        showError(`Download error: ${error.message}`);
    } finally {
        setButtonLoading('download-btn', false);
    }
}

/**
 * Reset recipient form
 */
function resetRecipientForm() {
    document.getElementById('recipient-otp-input').value = '';
    document.getElementById('verify-otp-btn').disabled = true;
    document.getElementById('download-btn').disabled = true;

    currentFileId = null;
    currentWrappedKey = null;
    currentWrappedKeySalt = null;
    currentFileData = null;
    currentFileName = null;

    showInfo('Form reset');
}

export {
    currentFileData, currentFileId, currentFileName, currentWrappedKey,
    currentWrappedKeySalt, setupRecipientListeners
};

