/**
 * Service Interface Types
 *
 * Type definitions for service interfaces and return types.
 */

import type { StorageStats } from './api';

/**
 * File storage service result
 */
export interface FileStorageResult {
    filename: string;
    path: string;
    size: number;
    savedAt: string;
}

/**
 * File metadata from storage
 */
export interface FileMetadata {
    filename: string;
    path: string;
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    exists: boolean;
}

/**
 * Storage health check response
 */
export interface StorageHealthCheck {
    status: 'healthy' | 'unhealthy';
    storage: 'accessible' | 'inaccessible';
    stats?: StorageStats;
    error?: string;
}

/**
 * Email service mail options
 */
export interface EmailOptions {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
}

/**
 * Email send result
 */
export interface EmailSendResult {
    messageId: string;
    mock?: boolean;
}

/**
 * Download link email data
 */
export interface DownloadLinkEmailData {
    fileName: string;
    fileSize: number;
    downloadUrl: string;
    expiryMinutes: number;
}

/**
 * OTP email data
 */
export interface OTPEmailData {
    fileName: string;
    downloadUrl: string;
    expiryMinutes: number;
    otp: string;
}
