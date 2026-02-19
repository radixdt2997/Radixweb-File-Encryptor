/**
 * Configuration Module
 *
 * Centralizes all configuration with sensible defaults.
 * In production, use environment variables for sensitive data.
 */

import dotenv from "dotenv";
import type {
  ServerConfig,
  DatabaseConfig,
  StorageConfig,
  EmailConfig,
  SecurityConfig,
  EmailMockConfig,
  LoggingConfig,
  ConfigSummary,
} from "./types/config";

// Load environment variables
dotenv.config();

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

const port = parseInt(process.env.PORT || "3000", 10);

const nodeEnv = (process.env.NODE_ENV || "development") as "development" | "production" | "test";
const swaggerEnabledEnv = process.env.SWAGGER_ENABLED === "true";

export const server: ServerConfig = {
  nodeEnv,
  port,
  host: process.env.HOST || "localhost",
  /** Backend API base URL (Swagger "Try it out", absolute links). Defaults to this server. */
  baseUrl: process.env.API_BASE_URL || `http://localhost:${port}`,
  /** Frontend URL for download links in emails (recipient opens this to enter OTP). */
  downloadPageBaseUrl:
    process.env.BASE_URL || process.env.FRONTEND_URL || "http://localhost:5173",
  docsEnabled: nodeEnv !== "production" ? true : swaggerEnabledEnv,
};

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export const database: DatabaseConfig = {
  path: process.env.DB_PATH || "./data/secure-files.db",
  useSqlite:
    process.env.USE_SQLITE === "true" ||
    process.env.NODE_ENV === "production",
};

// ============================================================================
// FILE STORAGE CONFIGURATION
// ============================================================================

export const storage: StorageConfig = {
  path: process.env.STORAGE_PATH || "./data/uploads",
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "104857600", 10), // 100MB
  retentionDays: parseInt(process.env.FILE_RETENTION_DAYS || "30", 10),
};

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

const emailPort = parseInt(process.env.EMAIL_PORT || "465", 10);
// Port 465 = implicit SSL; port 587 = STARTTLS (secure: false). Override with EMAIL_SECURE=true|false.
export const email: EmailConfig = {
  service: process.env.EMAIL_SERVICE || "smtp",
  host: process.env.EMAIL_HOST || "mail.mailtest.radixweb.net",
  port: emailPort,
  secure:
    process.env.EMAIL_SECURE !== undefined
      ? process.env.EMAIL_SECURE === "true"
      : emailPort === 465,
  user: process.env.EMAIL_USER || "testphp@mailtest.radixweb.net",
  pass: process.env.EMAIL_PASS || "Radix@web#8",
  from: process.env.EMAIL_FROM || "testphp@mailtest.radixweb.net",
};

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

export const security: SecurityConfig = {
  corsOrigin:
    process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173",
  rateLimitWindowMs:
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "3", 10),
  otpCooldownMs: parseInt(process.env.OTP_COOLDOWN_MS || "5000", 10), // 5 seconds
};

// ============================================================================
// EMAIL MOCK CONFIGURATION (Development)
// ============================================================================

export const emailMock: EmailMockConfig = {
  enabled:
    process.env.USE_MOCK_EMAIL !== "false" &&
    (process.env.USE_MOCK_EMAIL === "true" ||
      (process.env.NODE_ENV === "development" && process.env.USE_MOCK_EMAIL === undefined)),
};

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

export const logging: LoggingConfig = {
  /** Log level (reserved for future logger); auditEnabled gates audit writes in database.js. */
  level: process.env.LOG_LEVEL || "info",
  auditEnabled: process.env.AUDIT_LOG_ENABLED !== "false", // Default true
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
      path: database.path,
      useSqlite: database.useSqlite,
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
    logging: {
      level: logging.level,
      auditEnabled: logging.auditEnabled,
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

  // Check required paths exist or can be created
  if (!database.path) {
    errors.push("Database path is required");
  }

  if (!storage.path) {
    errors.push("Storage path is required");
  }

  // Check email configuration (warning only)
  if (!isEmailConfigured()) {
    console.warn(
      "⚠️  Email service not configured - file sharing will work but no emails will be sent",
    );
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(", ")}`);
  }

  return true;
}
