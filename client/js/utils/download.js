/**
 * File Download Utilities
 * 
 * Triggers browser download of encrypted/decrypted files.
 */

/**
 * Trigger download of a file in the browser
 * 
 * Creates a blob URL and simulates a click on a download link.
 * The browser handles the download.
 * 
 * @param {Uint8Array} data - File data to download
 * @param {string} filename - Filename for the download
 */
export function downloadFile(data, filename) {
    // Create blob from data
    const blob = new Blob([data], { type: 'application/octet-stream' });

    // Create object URL
    const url = URL.createObjectURL(blob);

    try {
        // Create temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        // Append to DOM (required for some browsers), click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        // Revoke object URL to free memory
        URL.revokeObjectURL(url);
    }
}

/**
 * Backwards-compatible alias used by Phase 2 pages.
 * Some modules import `downloadFileToUser` — keep it as an alias to `downloadFile`.
 *
 * @param {Uint8Array} data
 * @param {string} filename
 */
export function downloadFileToUser(data, filename) {
    return downloadFile(data, filename);
}

/**
 * Generate encrypted filename from original
 * 
 * @param {string} originalFilename - Original filename
 * @returns {string} - Encrypted filename with .enc extension
 */
export function getEncryptedFilename(originalFilename) {
    return `${originalFilename}.enc`;
}

/**
 * Generate decrypted filename from encrypted
 * 
 * Removes .enc extension if present, otherwise returns original.
 * 
 * @param {string} encryptedFilename - Encrypted filename
 * @returns {string} - Decrypted filename
 */
export function getDecryptedFilename(encryptedFilename) {
    if (encryptedFilename.endsWith('.enc')) {
        return encryptedFilename.slice(0, -4);
    }
    return encryptedFilename;
}
