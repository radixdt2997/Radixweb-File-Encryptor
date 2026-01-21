/**
 * Main Application Entry Point
 * 
 * Supports three modes:
 * 1. SENDER (Phase 2): Select file, encrypt locally, generate OTP, upload
 * 2. RECIPIENT (Phase 2): Enter OTP, unwrap key, download, decrypt locally
 * 3. LEGACY (Phase 1): Classic password-based encryption/decryption
 * 
 * NOTE: Email delivery is handled by Phase B (Node.js server)
 * This client handles only encryption/decryption and OTP management
 */

import { showSuccess, showError, showInfo } from './ui/feedback.js';
import { encryptFile, decryptFile } from './crypto/crypto.js';
import { downloadFile } from './utils/download.js';
import {
    generateOTP,
    wrapFileKey,
    unwrapFileKey,
    deriveOTPKey,
    hashOTP,
} from './crypto/wrapping.js';
import * as API from './utils/api.js';

// ============================================================================
// MODE MANAGEMENT
// ============================================================================

function setMode(mode) {
    const senderMode = document.getElementById('sender-mode');
    const recipientMode = document.getElementById('recipient-mode');
    const legacyMode = document.getElementById('legacy-mode');

    const modeSenderBtn = document.getElementById('mode-sender-btn');
    const modeRecipientBtn = document.getElementById('mode-recipient-btn');
    const modeLegacyBtn = document.getElementById('mode-legacy-btn');

    // Hide all modes
    senderMode.style.display = 'none';
    recipientMode.style.display = 'none';
    legacyMode.style.display = 'none';

    // Remove active class from all buttons
    modeSenderBtn.classList.remove('active');
    modeRecipientBtn.classList.remove('active');
    modeLegacyBtn.classList.remove('active');

    // Show selected mode and activate button
    if (mode === 'sender') {
        senderMode.style.display = 'block';
        modeSenderBtn.classList.add('active');
        initSenderMode();
    } else if (mode === 'recipient') {
        recipientMode.style.display = 'block';
        modeRecipientBtn.classList.add('active');
        initRecipientMode();
    } else if (mode === 'legacy') {
        legacyMode.style.display = 'block';
        modeLegacyBtn.classList.add('active');
        initLegacyMode();
    }

    showInfo(`Switched to ${mode} mode`);
}

// ============================================================================
// SENDER MODE (Phase 2)
// ============================================================================

let senderFileData = null;
let senderEncryptedData = null;
let senderFileKey = null;
let senderOTP = null;

function initSenderMode() {
    const fileInput = document.getElementById('sender-file-input');
    const recipientEmail = document.getElementById('sender-recipient-email');
    const expiryMinutes = document.getElementById('sender-expiry-minutes');
    const expiryType = document.getElementById('sender-expiry-type');
    const encryptBtn = document.getElementById('sender-encrypt-btn');
    const uploadBtn = document.getElementById('sender-upload-btn');
    const resetBtn = document.getElementById('sender-reset-btn');

    // Reset form state
    fileInput.value = '';
    recipientEmail.value = '';
    recipientEmail.disabled = true;
    expiryMinutes.disabled = true;
    expiryType.disabled = true;
    encryptBtn.disabled = true;
    uploadBtn.disabled = true;
    document.getElementById('sender-result').style.display = 'none';

    // File selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (file.size > 100 * 1024 * 1024) {
                showError('File is too large (max 100MB)');
                fileInput.value = '';
                return;
            }

            senderFileData = file;
            recipientEmail.disabled = false;
            expiryMinutes.disabled = false;
            expiryType.disabled = false;

            showSuccess(
                `File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`
            );
        }
    });

    // Enable encrypt when email is valid
    recipientEmail.addEventListener('input', () => {
        const hasFile = senderFileData !== null;
        const hasEmail = recipientEmail.value.trim().includes('@');
        encryptBtn.disabled = !(hasFile && hasEmail);
    });

    // Encrypt button
    encryptBtn.addEventListener('click', async () => {
        try {
            encryptBtn.disabled = true;
            uploadBtn.disabled = true;
            showInfo('Encrypting file...');

            // Read file
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const fileBuffer = new Uint8Array(event.target.result);

                    // Generate random file key (256-bit)
                    const fileKeyArray = crypto.getRandomValues(new Uint8Array(32));
                    senderFileKey = await crypto.subtle.importKey(
                        'raw',
                        fileKeyArray,
                        { name: 'AES-GCM', length: 256 },
                        true,
                        ['encrypt', 'decrypt']
                    );

                    // Encrypt file with file key using AES-GCM
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const encrypted = await crypto.subtle.encrypt(
                        { name: 'AES-GCM', iv: iv },
                        senderFileKey,
                        fileBuffer
                    );

                    senderEncryptedData = new Uint8Array(encrypted);

                    // Generate OTP (6-digit numeric)
                    senderOTP = generateOTP();

                    showSuccess(`✅ File encrypted! OTP: ${senderOTP}`);
                    uploadBtn.disabled = false;
                } catch (err) {
                    showError(`Encryption error: ${err.message}`);
                    encryptBtn.disabled = false;
                    uploadBtn.disabled = true;
                }
            };
            reader.readAsArrayBuffer(senderFileData);
        } catch (err) {
            showError(`Error: ${err.message}`);
            encryptBtn.disabled = false;
        }
    });

    // Upload button
    uploadBtn.addEventListener('click', async () => {
        try {
            uploadBtn.disabled = true;
            showInfo('Wrapping key and preparing share...');

            const recipientEmailValue = recipientEmail.value.trim();
            const expiryMinutesValue = parseInt(expiryMinutes.value);
            const expiryTypeValue = expiryType.value;

            // Wrap file key with OTP
            const { wrappedKeyData, salt } = await wrapFileKey(
                senderFileKey,
                senderOTP
            );

            // Hash OTP for server verification
            const otpHash = await hashOTP(senderOTP);

            showInfo(
                '📧 Phase B (Node.js server) will send emails.\n' +
                'For now: Share the link and OTP below via separate channels.'
            );

            // Try to upload (will fail gracefully if server not running)
            try {
                const response = await API.uploadFile({
                    fileName: senderFileData.name,
                    encryptedData: senderEncryptedData,
                    wrappedKey: wrappedKeyData,
                    wrappedKeySalt: salt,
                    recipientEmail: recipientEmailValue,
                    otpHash: otpHash,
                    expiryMinutes: expiryMinutesValue,
                    expiryType: expiryTypeValue,
                });

                const downloadLink = `${window.location.origin}?fileId=${response.fileId}`;
                showSenderResult(downloadLink, senderOTP);
                showSuccess('✅ File uploaded successfully!');
            } catch (err) {
                // Server not running - generate mock ID for demo
                const mockFileId = 'demo-' + Math.random().toString(36).substr(2, 9);
                const downloadLink = `${window.location.origin}?fileId=${mockFileId}`;
                showSenderResult(downloadLink, senderOTP);
                showError(
                    '⚠️ Server not running (Phase B needed for actual upload).\n' +
                    'Showing demo link & OTP for testing.'
                );
            }
        } catch (err) {
            showError(`Error: ${err.message}`);
            uploadBtn.disabled = false;
        }
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        fileInput.value = '';
        recipientEmail.value = '';
        expiryMinutes.value = '60';
        expiryType.value = 'time-based';
        encryptBtn.disabled = true;
        uploadBtn.disabled = true;
        recipientEmail.disabled = true;
        expiryMinutes.disabled = true;
        expiryType.disabled = true;
        senderFileData = null;
        senderEncryptedData = null;
        senderFileKey = null;
        senderOTP = null;
        document.getElementById('sender-result').style.display = 'none';
        showInfo('Form reset');
    });
}

function showSenderResult(link, otp) {
    const resultBox = document.getElementById('sender-result');
    const resultLink = document.getElementById('result-link');
    const resultOtp = document.getElementById('result-otp');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const copyOtpBtn = document.getElementById('copy-otp-btn');

    resultLink.textContent = link;
    resultOtp.textContent = otp;

    // Remove old listeners and add new ones
    const newCopyLinkBtn = copyLinkBtn.cloneNode(true);
    const newCopyOtpBtn = copyOtpBtn.cloneNode(true);
    copyLinkBtn.parentNode.replaceChild(newCopyLinkBtn, copyLinkBtn);
    copyOtpBtn.parentNode.replaceChild(newCopyOtpBtn, copyOtpBtn);

    newCopyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(link).then(() => {
            showSuccess('Link copied!');
        });
    });

    newCopyOtpBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(otp).then(() => {
            showSuccess('OTP copied!');
        });
    });

    resultBox.style.display = 'block';
}

// ============================================================================
// RECIPIENT MODE (Phase 2)
// ============================================================================

function initRecipientMode() {
    const otpInput = document.getElementById('recipient-otp-input');
    const verifyBtn = document.getElementById('verify-otp-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('recipient-reset-btn');

    // Reset form state
    otpInput.value = '';
    otpInput.disabled = false;
    verifyBtn.disabled = true;
    downloadBtn.disabled = true;

    showInfo('⚠️ Server required for recipient mode (Phase B)');

    // OTP input: only digits, max 6
    otpInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        verifyBtn.disabled = e.target.value.length !== 6;
    });

    // Verify OTP
    verifyBtn.addEventListener('click', async () => {
        try {
            verifyBtn.disabled = true;
            showInfo('Verifying OTP...');

            const otp = otpInput.value.trim();
            const params = new URLSearchParams(window.location.search);
            const fileId = params.get('fileId');

            if (!fileId) {
                showError('No fileId in URL. Open the download link provided by sender.');
                verifyBtn.disabled = false;
                return;
            }

            try {
                const response = await API.verifyOTP(fileId, otp);

                // Unwrap file key
                const fileKey = await unwrapFileKey(
                    response.wrappedKey,
                    response.wrappedKeySalt,
                    otp
                );

                showSuccess('✅ OTP verified! File ready to download.');
                downloadBtn.disabled = false;
                otpInput.disabled = true;

                // Store for download
                downloadBtn.fileKey = fileKey;
                downloadBtn.fileId = fileId;
            } catch (err) {
                showError(`OTP verification failed: ${err.message}`);
                verifyBtn.disabled = false;
            }
        } catch (err) {
            showError(`Error: ${err.message}`);
            verifyBtn.disabled = false;
        }
    });

    // Download button
    downloadBtn.addEventListener('click', async () => {
        try {
            downloadBtn.disabled = true;
            showInfo('Downloading file...');

            try {
                const response = await API.downloadFile(downloadBtn.fileId);

                // Decrypt file
                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: new Uint8Array(12) },
                    downloadBtn.fileKey,
                    response
                );

                downloadFile(new Uint8Array(decrypted), 'decrypted-file');
                showSuccess('✅ File downloaded and decrypted!');
            } catch (err) {
                showError(`Download failed: ${err.message}`);
                downloadBtn.disabled = false;
            }
        } catch (err) {
            showError(`Error: ${err.message}`);
            downloadBtn.disabled = false;
        }
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        otpInput.value = '';
        otpInput.disabled = false;
        verifyBtn.disabled = true;
        downloadBtn.disabled = true;
        showInfo('Form reset');
    });
}

// ============================================================================
// LEGACY MODE (Phase 1)
// ============================================================================

function initLegacyMode() {
    const fileInput = document.getElementById('file-input');
    const passwordInput = document.getElementById('password-input');
    const encryptBtn = document.getElementById('encrypt-btn');
    const decryptBtn = document.getElementById('decrypt-btn');
    const clearBtn = document.getElementById('clear-btn');

    // Reset form state
    fileInput.value = '';
    passwordInput.value = '';
    encryptBtn.disabled = true;
    decryptBtn.disabled = true;

    // Enable buttons when file and password are provided
    function checkFormReady() {
        const hasFile = fileInput.files && fileInput.files[0];
        const hasPassword = passwordInput.value.length >= 8;
        encryptBtn.disabled = !(hasFile && hasPassword);
        decryptBtn.disabled = !(hasFile && hasPassword);
    }

    fileInput.addEventListener('change', checkFormReady);
    passwordInput.addEventListener('input', checkFormReady);

    // Encrypt
    encryptBtn.addEventListener('click', async () => {
        try {
            encryptBtn.disabled = true;
            decryptBtn.disabled = true;
            const file = fileInput.files[0];
            const password = passwordInput.value;

            if (password.length < 8) {
                showError('Password must be at least 8 characters');
                encryptBtn.disabled = false;
                decryptBtn.disabled = false;
                return;
            }

            showInfo('Encrypting...');
            const encryptedBlob = await encryptFile(file, password);
            downloadFile(encryptedBlob, `${file.name}.enc`);
            showSuccess('✅ File encrypted and downloaded!');

            encryptBtn.disabled = false;
            decryptBtn.disabled = false;
        } catch (err) {
            showError(`Error: ${err.message}`);
            encryptBtn.disabled = false;
            decryptBtn.disabled = false;
        }
    });

    // Decrypt
    decryptBtn.addEventListener('click', async () => {
        try {
            decryptBtn.disabled = true;
            encryptBtn.disabled = true;
            const file = fileInput.files[0];
            const password = passwordInput.value;

            if (password.length < 8) {
                showError('Password must be at least 8 characters');
                decryptBtn.disabled = false;
                encryptBtn.disabled = false;
                return;
            }

            showInfo('Decrypting...');
            const decryptedBlob = await decryptFile(file, password);
            downloadFile(decryptedBlob, file.name.replace('.enc', ''));
            showSuccess('✅ File decrypted and downloaded!');

            decryptBtn.disabled = false;
            encryptBtn.disabled = false;
        } catch (err) {
            showError(`Error: ${err.message}`);
            decryptBtn.disabled = false;
            encryptBtn.disabled = false;
        }
    });

    // Clear
    clearBtn.addEventListener('click', () => {
        fileInput.value = '';
        passwordInput.value = '';
        encryptBtn.disabled = true;
        decryptBtn.disabled = true;
    });
}

// ============================================================================
// INITIALIZE
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Setup mode buttons
    document.getElementById('mode-sender-btn').addEventListener('click', () => setMode('sender'));
    document.getElementById('mode-recipient-btn').addEventListener('click', () => setMode('recipient'));
    document.getElementById('mode-legacy-btn').addEventListener('click', () => setMode('legacy'));

    // Initialize to sender mode
    setMode('sender');
});
