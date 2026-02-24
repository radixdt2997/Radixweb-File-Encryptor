import type {
    ApiErrorResponse,
    FileMetadata,
    RecipientInfo,
    UploadResult,
    VerifyOTPResult,
} from '../types';
import { env } from '../config/env';

const API_BASE = env.api.baseUrl;

/** Parse standard API error response and return user-facing message. */
async function getErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const body = (await response.json()) as ApiErrorResponse;
        return body.message ?? body.error ?? fallback;
    } catch {
        return fallback;
    }
}

export const api = {
    async uploadFile(formData: FormData): Promise<UploadResult> {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'Upload failed');
            throw new Error(message);
        }
        return response.json();
    },

    async getFileMetadata(fileId: string): Promise<FileMetadata> {
        const response = await fetch(`${API_BASE}/metadata/${fileId}`, {
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'File not found');
            throw new Error(message);
        }
        return response.json();
    },

    async verifyOTP(
        fileId: string,
        otp: string,
        recipientEmail?: string,
    ): Promise<VerifyOTPResult> {
        const response = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
                recipientEmail ? { fileId, otp, recipientEmail } : { fileId, otp },
            ),
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'OTP verification failed');
            throw new Error(message);
        }
        return response.json();
    },

    async downloadFile(fileId: string): Promise<ArrayBuffer> {
        const response = await fetch(`${API_BASE}/download/${fileId}`, {
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'Download failed');
            throw new Error(message);
        }
        return response.arrayBuffer();
    },

    async getRecipients(fileId: string): Promise<RecipientInfo[]> {
        const response = await fetch(`${API_BASE}/files/${fileId}/recipients`, {
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'Failed to load recipients');
            throw new Error(message);
        }
        const data = await response.json();
        return data.recipients;
    },

    async revokeRecipient(fileId: string, recipientId: string): Promise<void> {
        const response = await fetch(`${API_BASE}/files/${fileId}/recipients/${recipientId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'Failed to revoke recipient');
            throw new Error(message);
        }
    },
};
