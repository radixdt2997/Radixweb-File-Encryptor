/**
 * Configuration Types
 * 
 * Type definitions for all configuration interfaces.
 */

/**
 * Server configuration
 */
export interface ServerConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  host: string;
  baseUrl: string;
  downloadPageBaseUrl: string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  path: string;
  useSqlite: boolean;
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
  };
  database: {
    path: string;
    useSqlite: boolean;
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
}
