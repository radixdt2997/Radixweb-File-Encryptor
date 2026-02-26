/**
 * Database Types
 *
 * Type definitions for database models, queries, and operations.
 */

/** Role in a transaction (for "My transactions" list) */
export enum TransactionRole {
    Sender = 'sender',
    Recipient = 'recipient',
}

/** User role (auth) */
export enum UserRole {
    Admin = 'admin',
    User = 'user',
}

/** File expiry type */
export enum ExpiryType {
    OneTime = 'one-time',
    TimeBased = 'time-based',
}

/** File status */
export enum FileStatus {
    Active = 'active',
    Used = 'used',
    Expired = 'expired',
}

/**
 * User record (auth)
 */
export interface UserRecord {
    id: string;
    email: string;
    password_hash: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
}

/**
 * File record structure (PostgreSQL schema; uploaded_by_user_id for auth)
 */
export interface FileRecord {
    id?: number;
    file_id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    recipient_email: string;
    wrapped_key: Buffer | string;
    wrapped_key_salt: Buffer | string;
    otp_hash: string;
    expiry_type: ExpiryType;
    expiry_time: string;
    status: FileStatus;
    otp_attempts: number;
    last_attempt_at: string | null;
    created_at: string;
    downloaded_at: string | null;
    total_recipients?: number;
    verified_recipients?: number;
    downloaded_recipients?: number;
    /** User who uploaded the file (null for legacy/migrated rows) */
    uploaded_by_user_id?: string | null;
}

/**
 * Recipient record structure (matches PostgreSQL schema)
 */
export interface RecipientRecord {
    id: string;
    file_id: string;
    email: string;
    otp_hash: string;
    wrapped_key: Buffer | string;
    wrapped_key_salt: Buffer | string;
    otp_verified_at: string | null;
    downloaded_at: string | null;
    otp_attempts: number;
    last_attempt_at: string | null;
    created_at: string;
}

/**
 * Audit log record structure
 */
export interface AuditLogRecord {
    id?: number;
    file_id: string;
    event_type: string;
    ip_address: string | null;
    user_agent: string | null;
    details: string; // JSON string
    created_at: string;
}

/**
 * Recipient audit log record structure
 */
export interface RecipientAuditLogRecord {
    id: string;
    file_id: string;
    recipient_id: string;
    event_type: string;
    ip_address: string | null;
    user_agent: string | null;
    details: string; // JSON string
    created_at: string;
}

/**
 * Input data for creating a file record
 */
export interface CreateFileData {
    fileId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    recipientEmail: string;
    wrappedKey: Buffer;
    wrappedKeySalt: Buffer;
    otpHash: string;
    expiryMinutes: number;
    expiryType: ExpiryType;
    /** User who uploaded (required when auth is enabled) */
    uploadedByUserId?: string | null;
}

/**
 * Input data for creating a recipient record
 */
export interface CreateRecipientData {
    id?: string;
    fileId: string;
    email: string;
    otpHash: string;
    wrappedKey: string | Buffer;
    wrappedKeySalt: string | Buffer;
    otpVerifiedAt?: string | null;
    downloadedAt?: string | null;
    otpAttempts?: number;
    lastAttemptAt?: string | null;
}

/**
 * Additional data for updating file status
 */
export interface UpdateFileStatusData {
    downloadedAt?: string;
    otpAttempts?: number;
    lastAttemptAt?: string;
}

// DatabaseStats is exported from api.ts to avoid duplication

/**
 * Health check response
 */
export interface DatabaseHealthCheck {
    status: 'healthy' | 'unhealthy';
    database: 'connected' | 'disconnected';
    error?: string;
}
