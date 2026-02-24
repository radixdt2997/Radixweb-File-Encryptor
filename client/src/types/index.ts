export interface FileMetadata {
    fileName: string;
    fileSize: number;
    expiryTime: string;
    expiryType: string;
    uploadedAt: string;
}

export interface UploadResult {
    downloadUrl: string;
    fileId: string;
    message: string;
    uploadedAt: string;
    expiresAt: string;
}

export interface VerifyOTPResult {
    wrappedKey: string;
    wrappedKeySalt: string;
    fileName: string;
    fileSize: number;
    verifiedAt: string;
}

export interface RecipientInfo {
    id: string;
    email: string;
    otpAttempts: number;
    createdAt: string;
    downloadedAt: string | null;
    otpVerifiedAt: string | null;
}

export interface SenderState {
    file: File | null;
    key: CryptoKey | null;
}

export interface RecipientState {
    fileId: string | null;
    loaded: boolean;
}

export type TabType = 'sender' | 'recipient' | 'legacy';
export type MessageType = 'info' | 'success' | 'error';

/**
 * Standard API error response from the server.
 * All error responses use this shape so the client can parse them consistently.
 */
export interface ApiErrorResponse {
    /** Short error code (e.g. "Validation Error", "Too Many Attempts") */
    error: string;
    /** User-facing message */
    message: string;
    /** Optional extra data (validation details, attemptsRemaining, etc.) */
    details?: unknown;
}
