import { API_CONFIG } from "./constants.js";

/**
 * API Client
 * 
 * Communicates with the server for Phase 2 operations:
 * - Upload encrypted files with wrapped keys
 * - Verify OTP and retrieve wrapped keys
 * - Download encrypted files
 * 
 * All sensitive operations happen client-side.
 * The server never sees plaintext files or fileKeys.
 */

const API_BASE_URL = API_CONFIG.BASE_URL;

/**
 * Upload an encrypted file to the server
 * 
 * @param {Object} params
 * @param {string} params.fileName - Original file name
 * @param {Uint8Array} params.encryptedData - Encrypted file data
 * @param {Uint8Array} params.wrappedKey - Wrapped (encrypted) fileKey
 * @param {Uint8Array} params.wrappedKeySalt - Salt used for key wrapping
 * @param {string} params.recipientEmail - Email of recipient
 * @param {string} params.otpHash - Hash of the OTP
 * @param {number} params.expiryMinutes - File expiry time in minutes
 * @param {string} [params.expiryType] - 'one-time' or 'time-based' (default: 'time-based')
 * @returns {Promise<{fileId: string, downloadUrl: string}>}
 */
export async function uploadFile({
    fileName,
    encryptedData,
    wrappedKey,
    wrappedKeySalt,
    recipientEmail,
    otpHash,
    expiryMinutes = 60,
    expiryType = 'time-based'
}) {
    const formData = new FormData();
    formData.append('fileName', fileName);
    formData.append('encryptedData', new Blob([encryptedData]));
    formData.append('wrappedKey', new Blob([wrappedKey]));
    formData.append('wrappedKeySalt', new Blob([wrappedKeySalt]));
    formData.append('recipientEmail', recipientEmail);
    formData.append('otpHash', otpHash);
    formData.append('expiryMinutes', expiryMinutes);
    formData.append('expiryType', expiryType);

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
        }

        return await response.json();
    } catch (error) {
        throw new Error(`API upload error: ${error.message}`);
    }
}

/**
 * Verify OTP and retrieve wrapped key
 * 
 * Called by recipient after entering OTP on the verify page.
 * The server validates the OTP hash and returns the wrapped key.
 * 
 * @param {string} fileId - Unique file ID from the link
 * @param {string} otp - 6-digit OTP entered by recipient
 * @returns {Promise<{wrappedKey: Uint8Array, wrappedKeySalt: Uint8Array, fileName: string, fileSize: number}>}
 */
export async function verifyOTP(fileId, otp) {
    try {
        const response = await fetch(`${API_BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileId,
                otp
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'OTP verification failed');
        }

        const data = await response.json();

        // Convert base64 back to Uint8Array if needed
        if (typeof data.wrappedKey === 'string') {
            data.wrappedKey = new Uint8Array(
                atob(data.wrappedKey).split('').map(c => c.charCodeAt(0))
            );
        }
        if (typeof data.wrappedKeySalt === 'string') {
            data.wrappedKeySalt = new Uint8Array(
                atob(data.wrappedKeySalt).split('').map(c => c.charCodeAt(0))
            );
        }

        return data;
    } catch (error) {
        throw new Error(`API OTP verification error: ${error.message}`);
    }
}

/**
 * Download encrypted file from server
 * 
 * Called after OTP is verified. Downloads the encrypted file blob.
 * 
 * @param {string} fileId - Unique file ID
 * @returns {Promise<Uint8Array>} Encrypted file data
 */
export async function downloadFile(fileId) {
    try {
        const response = await fetch(`${API_BASE_URL}/download/${fileId}`, {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        throw new Error(`API download error: ${error.message}`);
    }
}

/**
 * Get file metadata (without downloading the file)
 * Used to display file info before OTP entry
 * 
 * @param {string} fileId - Unique file ID
 * @returns {Promise<{fileName: string, fileSize: number, expiryTime: number}>}
 */
export async function getFileMetadata(fileId) {
    try {
        const response = await fetch(`${API_BASE_URL}/metadata/${fileId}`, {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error('Metadata fetch failed');
        }

        return await response.json();
    } catch (error) {
        throw new Error(`API metadata error: ${error.message}`);
    }
}

/**
 * Health check - verify server is running
 * 
 * @returns {Promise<boolean>} true if server is reachable
 */
export async function healthCheck() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET'
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}
