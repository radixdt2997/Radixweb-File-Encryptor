/**
 * Configuration Module
 *
 * Centralizes all configuration with sensible defaults.
 * In production, use environment variables for sensitive data.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export const server = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`
};

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export const database = {
  path: process.env.DB_PATH || './data/secure-files.db'
};

// ============================================================================
// FILE STORAGE CONFIGURATION
// ============================================================================

export const storage = {
  path: process.env.STORAGE_PATH || './data/uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
  retentionDays: parseInt(process.env.FILE_RETENTION_DAYS) || 30
};

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

export const email = {
  service: process.env.EMAIL_SERVICE || 'smtp',
  host: process.env.EMAIL_HOST || 'mail.mailtest.radixweb.net',
  port: parseInt(process.env.EMAIL_PORT) || 465, // Try SSL port 465
  secure: true, // true for SSL, false for STARTTLS
  user: process.env.EMAIL_USER || 'testphp@mailtest.radixweb.net',
  pass: process.env.EMAIL_PASS || 'Radix@web#8',
  from: process.env.EMAIL_FROM || 'testphp@mailtest.radixweb.net'
};

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

export const security = {
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5500',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3,
  otpCooldownMs: parseInt(process.env.OTP_COOLDOWN_MS) || 5000 // 5 seconds
};

// ============================================================================
// EMAIL MOCK CONFIGURATION (Development)
// ============================================================================

export const emailMock = {
  enabled: process.env.USE_MOCK_EMAIL === 'true' || process.env.NODE_ENV === 'development'
};

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

export const logging = {
  level: process.env.LOG_LEVEL || 'info',
  auditEnabled: process.env.AUDIT_LOG_ENABLED !== 'false' // Default true
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if email service is properly configured
 */
export function isEmailConfigured() {
  return !!(email.user && email.pass);
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary() {
  return {
    server: {
      environment: server.nodeEnv,
      port: server.port,
      host: server.host
    },
    database: {
      path: database.path
    },
    storage: {
      path: storage.path,
      maxFileSizeMB: (storage.maxFileSize / (1024 * 1024)).toFixed(2),
      retentionDays: storage.retentionDays
    },
    email: {
      configured: isEmailConfigured(),
      service: email.service,
      from: email.from
    },
    security: {
      corsOrigin: security.corsOrigin,
      rateLimitMaxRequests: security.rateLimitMaxRequests,
      otpMaxAttempts: security.otpMaxAttempts
    }
  };
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validate critical configuration on startup
 */
export function validateConfiguration() {
  const errors = [];

  // Check required paths exist or can be created
  if (!database.path) {
    errors.push('Database path is required');
  }

  if (!storage.path) {
    errors.push('Storage path is required');
  }

  // Check email configuration (warning only)
  if (!isEmailConfigured()) {
    console.warn('⚠️  Email service not configured - file sharing will work but no emails will be sent');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }

  return true;
}