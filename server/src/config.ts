/**
 * Configuration Module
 *
 * Centralizes all configuration with sensible defaults.
 * In production, use environment variables for sensitive data.
 */

import dotenv from 'dotenv';
import type {
    ConfigSummary,
    AuthConfig,
    DatabaseConfig,
    EmailConfig,
    EmailMockConfig,
    EncryptionConfig,
    LoggingConfig,
    SecurityConfig,
    ServerConfig,
    StorageConfig,
} from './types/config';

dotenv.config();

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

const port = parseInt(process.env.PORT || '3000', 10);

const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
const swaggerEnabledEnv = process.env.SWAGGER_ENABLED === 'true';

export const server: ServerConfig = {
    nodeEnv,
    port,
    host: process.env.HOST || 'localhost',
    /** Backend API base URL (Swagger "Try it out", absolute links). Defaults to this server. */
    baseUrl: process.env.API_BASE_URL || `http://localhost:${port}`,
    /** Frontend URL for download links in emails (recipient opens this to enter OTP). */
    downloadPageBaseUrl:
        process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
    docsEnabled: nodeEnv !== 'production' ? true : swaggerEnabledEnv,
};

// ============================================================================
// DATABASE CONFIGURATION (PostgreSQL)
// ============================================================================

export const database: DatabaseConfig = {
    databaseUrl: process.env.DATABASE_URL || '',
};

// ============================================================================
// FILE STORAGE CONFIGURATION
// ============================================================================

export const storage: StorageConfig = {
    path: process.env.STORAGE_PATH || './data/uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
    retentionDays: parseInt(process.env.FILE_RETENTION_DAYS || '30', 10),
};

// ============================================================================
// ENCRYPTION AT REST CONFIGURATION
// ============================================================================

function parseMasterKey(raw: string | undefined): Buffer | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim().replace(/\s/g, '');
    if (!trimmed) return null;
    try {
        if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
            return Buffer.from(trimmed, 'hex');
        }
        const decoded = Buffer.from(trimmed, 'base64');
        if (decoded.length === 32) return decoded;
        return null;
    } catch {
        return null;
    }
}

export const encryption: EncryptionConfig = {
    masterKey: parseMasterKey(process.env.ENCRYPTION_MASTER_KEY),
    enabled: process.env.ENCRYPTION_ENABLED === 'true',
};

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

const emailPort = parseInt(process.env.EMAIL_PORT || '465', 10);
// Port 465 = implicit SSL; port 587 = STARTTLS (secure: false). Override with EMAIL_SECURE=true|false.
export const email: EmailConfig = {
    service: process.env.EMAIL_SERVICE || 'smtp',
    host: process.env.EMAIL_HOST || 'mail.mailtest.radixweb.net',
    port: emailPort,
    secure:
        process.env.EMAIL_SECURE !== undefined
            ? process.env.EMAIL_SECURE === 'true'
            : emailPort === 465,
    user: process.env.EMAIL_USER || 'testphp@mailtest.radixweb.net',
    pass: process.env.EMAIL_PASS || 'Radix@web#8',
    from: process.env.EMAIL_FROM || 'testphp@mailtest.radixweb.net',
};

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

export const security: SecurityConfig = {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
    otpCooldownMs: parseInt(process.env.OTP_COOLDOWN_MS || '5000', 10), // 5 seconds
    uploadLimitWindowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    uploadLimitMaxRequests: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS || '20', 10),
    fileAccessLimitWindowMs: parseInt(process.env.FILE_ACCESS_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    fileAccessLimitMaxRequests: parseInt(
        process.env.FILE_ACCESS_RATE_LIMIT_MAX_REQUESTS || '30',
        10,
    ),
    recipientAccessLimitWindowMs: parseInt(
        process.env.RECIPIENT_ACCESS_RATE_LIMIT_WINDOW_MS || '900000',
        10,
    ), // 15 minutes
    recipientAccessLimitMaxRequests: parseInt(
        process.env.RECIPIENT_ACCESS_RATE_LIMIT_MAX_REQUESTS || '5',
        10,
    ),
};

// ============================================================================
// AUTH CONFIGURATION
// ============================================================================

export const auth: AuthConfig = {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '3600', 10), // 1 hour default
    allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || 'radixweb.com',
    allowSelfRegistration: process.env.ALLOW_SELF_REGISTRATION !== 'false',
};

// ============================================================================
// EMAIL MOCK CONFIGURATION (Development)
// ============================================================================

export const emailMock: EmailMockConfig = {
    enabled:
        process.env.USE_MOCK_EMAIL !== 'false' &&
        (process.env.USE_MOCK_EMAIL === 'true' ||
            (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_EMAIL === undefined)),
};

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

export const logging: LoggingConfig = {
    /** Log level (reserved for future logger); auditEnabled gates audit writes in database.js. */
    level: process.env.LOG_LEVEL || 'info',
    auditEnabled: process.env.AUDIT_LOG_ENABLED !== 'false', // Default true
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if email service is properly configured (used internally by getConfigSummary & validateConfiguration).
 */
function isEmailConfigured(): boolean {
    return !!(email.user && email.pass);
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary(): ConfigSummary {
    return {
        server: {
            environment: server.nodeEnv,
            port: server.port,
            host: server.host,
            downloadPageBaseUrl: server.downloadPageBaseUrl,
            docsEnabled: server.docsEnabled,
        },
        database: {
            databaseUrl: database.databaseUrl ? '[SET]' : '[MISSING]',
        },
        storage: {
            path: storage.path,
            maxFileSizeMB: (storage.maxFileSize / (1024 * 1024)).toFixed(2),
            retentionDays: storage.retentionDays,
        },
        email: {
            configured: isEmailConfigured(),
            service: email.service,
            from: email.from,
        },
        security: {
            corsOrigin: security.corsOrigin,
            rateLimitMaxRequests: security.rateLimitMaxRequests,
            otpMaxAttempts: security.otpMaxAttempts,
        },
        auth: {
            jwtSecret: !!auth.jwtSecret,
            allowedEmailDomain: auth.allowedEmailDomain,
            allowSelfRegistration: auth.allowSelfRegistration,
        },
        logging: {
            level: logging.level,
            auditEnabled: logging.auditEnabled,
        },
        encryption: {
            enabled: encryption.enabled,
            keyConfigured: encryption.masterKey !== null,
        },
    };
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validate critical configuration on startup
 */
export function validateConfiguration(): boolean {
    const errors: string[] = [];

    // PostgreSQL required
    if (!database.databaseUrl || database.databaseUrl.trim() === '') {
        errors.push('DATABASE_URL is required (PostgreSQL connection string)');
    }

    if (!storage.path) {
        errors.push('Storage path is required');
    }

    // Check email configuration (warning only)
    if (!isEmailConfigured()) {
        console.warn(
            '⚠️  Email service not configured - file sharing will work but no emails will be sent',
        );
    }

    // Encryption at rest: require master key when enabled
    if (encryption.enabled && !encryption.masterKey) {
        errors.push(
            'ENCRYPTION_ENABLED is true but ENCRYPTION_MASTER_KEY is missing or invalid (must be 32 bytes: 64 hex chars or 44 base64 chars)',
        );
    }

    // Auth: require JWT secret
    if (!auth.jwtSecret || auth.jwtSecret.trim() === '') {
        errors.push('JWT_SECRET is required for authentication');
    }

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    return true;
}
