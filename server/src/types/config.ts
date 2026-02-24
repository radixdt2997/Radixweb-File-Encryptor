/**
 * Configuration Types
 *
 * Type definitions for all configuration interfaces.
 */

/**
 * Server configuration
 */
export interface ServerConfig {
    nodeEnv: 'development' | 'production' | 'test';
    port: number;
    host: string;
    baseUrl: string;
    downloadPageBaseUrl: string;
    /** Enable Swagger UI at /api-docs. Default: true in dev, false in production unless SWAGGER_ENABLED=true */
    docsEnabled: boolean;
}

/**
 * Database configuration (PostgreSQL for Phase 6)
 */
export interface DatabaseConfig {
    /** PostgreSQL connection URL. Required for Phase 6 (dev and prod use different URLs). */
    databaseUrl: string;
}

/**
 * File storage configuration
 */
export interface StorageConfig {
    path: string;
    maxFileSize: number;
    retentionDays: number;
}

/**
 * Encryption at rest configuration
 */
export interface EncryptionConfig {
    /** Master key (KEK) for deriving file and DB DEKs. 32 bytes (64 hex or 44 base64). */
    masterKey: Buffer | null;
    /** Enable server-side encryption at rest for files and DB. Default false for safe rollout. */
    enabled: boolean;
}

/**
 * Email service configuration
 */
export interface EmailConfig {
    service: string;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
    corsOrigin: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    otpMaxAttempts: number;
    otpCooldownMs: number;
    /** Upload rate limit: window (ms) and max requests per window */
    uploadLimitWindowMs: number;
    uploadLimitMaxRequests: number;
    /** File access (metadata, download) rate limit */
    fileAccessLimitWindowMs: number;
    fileAccessLimitMaxRequests: number;
    /** Recipient list access rate limit */
    recipientAccessLimitWindowMs: number;
    recipientAccessLimitMaxRequests: number;
}

/**
 * Auth configuration (Phase 6)
 */
export interface AuthConfig {
    /** Secret for signing JWTs (required for auth) */
    jwtSecret: string;
    /** Access token expiry in seconds (e.g. 900 = 15 min) */
    jwtExpiresInSeconds: number;
    /** Allowed email domain for login/register (e.g. radixweb.com) */
    allowedEmailDomain: string;
    /** Allow self-registration; if false, only admin can create users */
    allowSelfRegistration: boolean;
}

/**
 * Email mock configuration
 */
export interface EmailMockConfig {
    enabled: boolean;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
    level: string;
    auditEnabled: boolean;
}

/**
 * Configuration summary for logging
 */
export interface ConfigSummary {
    server: {
        environment: string;
        port: number;
        host: string;
        downloadPageBaseUrl: string;
        docsEnabled: boolean;
    };
    database: {
        databaseUrl: string;
    };
    storage: {
        path: string;
        maxFileSizeMB: string;
        retentionDays: number;
    };
    email: {
        configured: boolean;
        service: string;
        from: string;
    };
    security: {
        corsOrigin: string;
        rateLimitMaxRequests: number;
        otpMaxAttempts: number;
    };
    logging: {
        level: string;
        auditEnabled: boolean;
    };
    encryption?: {
        enabled: boolean;
        keyConfigured: boolean;
    };
    auth?: {
        jwtSecret: boolean;
        allowedEmailDomain: string;
        allowSelfRegistration: boolean;
    };
}
