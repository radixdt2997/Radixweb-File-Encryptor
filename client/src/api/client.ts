import type {
    ApiErrorResponse,
    FileMetadata,
    RecipientInfo,
    TransactionsResponse,
    UploadResult,
    VerifyOTPResult,
} from '../types';
import { env } from '../config/env';

const API_BASE = env.api.baseUrl;

/** Auth response shapes */
export interface LoginResponse {
    token: string;
    user: { id: string; email: string; role: string };
}
export interface MeResponse {
    user: { id: string; email: string; role: string };
}

/** Parse standard API error response and return user-facing message. */
async function getErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const body = (await response.json()) as ApiErrorResponse;
        return body.message ?? body.error ?? fallback;
    } catch {
        return fallback;
    }
}

function authHeaders(token: string | null): HeadersInit {
    const headers: HeadersInit = {};
    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

let onAuthError: (() => void) | null = null;

export function setAuthErrorHandler(cb: () => void): void {
    onAuthError = cb;
}

export const api = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'Login failed');
            throw new Error(message);
        }
        return response.json();
    },

    async register(email: string, password: string): Promise<LoginResponse> {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
        });
        if (!response.ok) {
            const message = await getErrorMessage(response, 'Registration failed');
            throw new Error(message);
        }
        return response.json();
    },

    async getTransactions(
        token: string | null,
        params?: {
            page?: number;
            limit?: number;
            type?: 'sent' | 'received';
            scope?: 'all';
            fileName?: string;
            email?: string;
        },
    ): Promise<TransactionsResponse> {
        const search = new URLSearchParams();
        if (params?.page) search.set('page', String(params.page));
        if (params?.limit) search.set('limit', String(params.limit));
        if (params?.type) search.set('type', params.type);
        if (params?.scope) search.set('scope', params.scope);
        if (params?.fileName?.trim()) search.set('fileName', params.fileName.trim());
        if (params?.email?.trim()) search.set('email', params.email.trim());
        const qs = search.toString();
        const url = `${API_BASE}/transactions${qs ? `?${qs}` : ''}`;
        const response = await fetch(url, {
            headers: authHeaders(token),
            credentials: 'include',
        });
        if (!response.ok) {
            if (response.status === 401 && onAuthError) onAuthError();
            const message = await getErrorMessage(response, 'Failed to load transactions');
            throw new Error(message);
        }
        return response.json();
    },

    async getMe(token: string): Promise<MeResponse> {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: authHeaders(token),
            credentials: 'include',
        });
        if (!response.ok) {
            if (response.status === 401 && onAuthError) onAuthError();
            const message = await getErrorMessage(response, 'Session invalid');
            throw new Error(message);
        }
        return response.json();
    },

    async uploadFile(formData: FormData, token: string | null): Promise<UploadResult> {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: authHeaders(token),
            body: formData,
            credentials: 'include',
        });
        if (!response.ok) {
            if (response.status === 401 && onAuthError) onAuthError();
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

    async getRecipients(fileId: string, token: string | null): Promise<RecipientInfo[]> {
        const response = await fetch(`${API_BASE}/files/${fileId}/recipients`, {
            headers: authHeaders(token),
            credentials: 'include',
        });
        if (!response.ok) {
            if (response.status === 401 && onAuthError) onAuthError();
            const message = await getErrorMessage(response, 'Failed to load recipients');
            throw new Error(message);
        }
        const data = await response.json();
        return data.recipients;
    },

    async revokeRecipient(
        fileId: string,
        recipientId: string,
        token: string | null,
    ): Promise<void> {
        const response = await fetch(`${API_BASE}/files/${fileId}/recipients/${recipientId}`, {
            method: 'DELETE',
            headers: authHeaders(token),
            credentials: 'include',
        });
        if (!response.ok) {
            if (response.status === 401 && onAuthError) onAuthError();
            const message = await getErrorMessage(response, 'Failed to revoke recipient');
            throw new Error(message);
        }
    },
};
