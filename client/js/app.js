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
import { initSenderPage } from './pages/send.js';
import { initRecipientPage, setupRecipientListeners } from './pages/receive.js';

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
        initSenderPage();
    } else if (mode === 'recipient') {
        recipientMode.style.display = 'block';
        modeRecipientBtn.classList.add('active');
        setupRecipientListeners();
        // Check if there's a fileId in URL for recipient mode
        const params = new URLSearchParams(window.location.search);
        const fileId = params.get('fileId');
        if (fileId) {
            initRecipientPage(fileId);
        }
    } else if (mode === 'legacy') {
        legacyMode.style.display = 'block';
        modeLegacyBtn.classList.add('active');
        initLegacyMode();
    }

    showInfo(`Switched to ${mode} mode`);
}

// ============================================================================
// SENDER MODE (Phase 2) - Handled by send.js
// ============================================================================

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
// LEGACY MODE (Phase 1)
// ============================================================================

function initLegacyMode() {
    const encryptionForm = document.getElementById('encryption-form');
    const fileInput = document.getElementById('file-input');
    const passwordInput = document.getElementById('password-input');
    const encryptBtn = document.getElementById('encrypt-btn');
    const decryptBtn = document.getElementById('decrypt-btn');
    const clearBtn = document.getElementById('clear-btn');

    // Prevent form submission on any button click
    encryptionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        return false;
    });

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
    encryptBtn.addEventListener('click', async (e) => {
        e.preventDefault();
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
    decryptBtn.addEventListener('click', async (e) => {
        e.preventDefault();
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
    clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
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
    document.getElementById('mode-sender-btn').addEventListener('click', (e) => {
        e.preventDefault();
        setMode('sender');
    });
    document.getElementById('mode-recipient-btn').addEventListener('click', (e) => {
        e.preventDefault();
        setMode('recipient');
    });
    document.getElementById('mode-legacy-btn').addEventListener('click', (e) => {
        e.preventDefault();
        setMode('legacy');
    });

    // Initialize to sender mode
    setMode('sender');
});
