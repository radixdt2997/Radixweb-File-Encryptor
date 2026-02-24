/**
 * API Request and Response Types
 *
 * Type definitions for all API endpoints in the Secure File Server.
 */

import type { DatabaseHealthCheck, ExpiryType, TransactionRole } from './database';
import { StorageHealthCheck } from './services';

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

/**
 * Recipient data structure for multi-recipient uploads
 */
export interface RecipientPayload {
    email: string;
    otp: string;
    otpHash: string;
    wrappedKey: string;
    wrappedKeySalt: string;
}

/**
 * Request body for POST /api/upload
 */
export interface UploadRequest {
    fileName: string;
    expiryMinutes: number;
    expiryType: ExpiryType;
    recipientEmail?: string; // Legacy single-recipient field
    otpHash?: string; // Legacy field
    otp?: string; // Legacy field
    recipients?: string; // JSON string of RecipientPayload[]
}

/**
 * Response for POST /api/upload
 */
export interface UploadResponse {
    fileId: string;
    downloadUrl: string;
    message: string;
    uploadedAt: string;
    expiresAt: string;
}

/**
 * Request body for POST /api/verify-otp
 */
export interface VerifyOTPRequest {
    fileId: string;
    otp: string;
    recipientEmail?: string;
}

/**
 * Response for POST /api/verify-otp
 */
export interface VerifyOTPResponse {
    wrappedKey: string;
    wrappedKeySalt: string;
    fileName: string;
    fileSize: number;
    verifiedAt: string;
}

/**
 * Response for GET /api/metadata/:fileId
 */
export interface MetadataResponse {
    fileName: string;
    fileSize: number;
    expiryTime: string;
    expiryType: string;
    uploadedAt: string;
}

/**
 * Response for GET /api/transactions (Phase 6)
 */
export interface TransactionsResponse {
    items: TransactionItem[];
    total: number;
    page: number;
    limit: number;
}

export interface TransactionItem {
    fileId: string;
    fileName: string;
    uploadedAt: string;
    expiryTime: string;
    status: string;
    recipientCount: number;
    role: TransactionRole;
}

/**
 * Response for GET /api/files/:fileId/recipients
 */
export interface RecipientsListResponse {
    recipients: RecipientInfo[];
}

/**
 * Recipient information (matches frontend RecipientInfo)
 */
export interface RecipientInfo {
    id: string;
    email: string;
    otpAttempts: number;
    createdAt: string;
    downloadedAt: string | null;
    otpVerifiedAt: string | null;
}

/**
 * Request body for POST /api/test-email
 */
export interface TestEmailRequest {
    email: string;
}

/**
 * Response for POST /api/test-email
 */
export interface TestEmailResponse {
    success: boolean;
    message: string;
    messageId: string;
    to: string;
}

export enum HealthStatus {
    Healthy = 'healthy',
    Unhealthy = 'unhealthy',
}

/**
 * Response for GET /api/health
 */
export interface HealthResponse {
    status: HealthStatus;
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    services: {
        database: DatabaseHealthCheck;
        storage: StorageHealthCheck;
    };
    stats: {
        database: DatabaseStats | null;
        storage: StorageStats | null;
    };
    responseTime: number;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
    active_files: number;
    used_files: number;
    expired_files: number;
    total_logs: number;
    total_size_bytes: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: string;
    storagePath: string;
    maxFileSizeMB: string;
    retentionDays: number;
}
