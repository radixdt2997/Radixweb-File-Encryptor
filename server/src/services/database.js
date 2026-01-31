/**
 * Database Service - SQLite Implementation
 *
 * Handles all database operations for the secure file server.
 * Uses SQLite for simplicity and zero-configuration deployment.
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/secure-files.db');

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

const CREATE_TABLES_SQL = `
-- Files table: stores encrypted file metadata and wrapped keys
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  file_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,        -- Base64 encoded wrapped key
  wrapped_key_salt TEXT NOT NULL,   -- Base64 encoded salt for OTP key derivation
  otp_hash TEXT NOT NULL,           -- SHA-256 hash of OTP (base64)
  expiry_type TEXT NOT NULL CHECK (expiry_type IN ('one-time', 'time-based')),
  expiry_time DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used')),
  otp_attempts INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  downloaded_at DATETIME
);

-- Create indexes separately (SQLite syntax)
CREATE INDEX IF NOT EXISTS idx_files_file_id ON files(file_id);
CREATE INDEX IF NOT EXISTS idx_files_recipient_email ON files(recipient_email);
CREATE INDEX IF NOT EXISTS idx_files_expiry_time ON files(expiry_time);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

-- Recipients table: tracks recipient interactions (optional but useful for analytics)
CREATE TABLE IF NOT EXISTS recipients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_verified_at DATETIME,
  downloaded_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for recipients table
CREATE INDEX IF NOT EXISTS idx_recipients_file_id ON recipients(file_id);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);

-- Audit logs table: comprehensive logging of all operations
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  file_id TEXT REFERENCES files(file_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('upload', 'otp_requested', 'otp_verified', 'otp_failed', 'download', 'expired', 'deleted')),
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,  -- JSON string with additional context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_file_id ON audit_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Settings table: store application configuration
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// ============================================================================
// DATABASE CONNECTION MANAGEMENT
// ============================================================================

let dbInstance = null;

/**
 * Get database connection (singleton pattern)
 */
export async function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    await fs.mkdir(dataDir, { recursive: true });

    // Open database connection
    dbInstance = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });

    // Enable foreign keys and WAL mode for better performance
    await dbInstance.exec('PRAGMA foreign_keys = ON;');
    await dbInstance.exec('PRAGMA journal_mode = WAL;');
    await dbInstance.exec('PRAGMA synchronous = NORMAL;');
    await dbInstance.exec('PRAGMA cache_size = 1000;');
    await dbInstance.exec('PRAGMA temp_store = memory;');

    return dbInstance;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Initialize database schema
 */
export async function initDatabase() {
  const db = await getDatabase();

  try {
    // Create all tables
    await db.exec(CREATE_TABLES_SQL);
    console.log('✅ Database schema initialized');

    // Insert default settings if not exists
    await db.run(`
      INSERT OR IGNORE INTO settings (key, value) VALUES
      ('version', '1.0.0'),
      ('initialized_at', ?)
    `, new Date().toISOString());

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Create a new file record
 */
export async function createFileRecord(fileData) {
  const db = await getDatabase();

  const {
    fileId,
    fileName,
    filePath,
    fileSize,
    recipientEmail,
    wrappedKey,
    wrappedKeySalt,
    otpHash,
    expiryMinutes,
    expiryType = 'time-based'
  } = fileData;

  // Calculate expiry time
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);

  const result = await db.run(`
    INSERT INTO files (
      file_id, file_name, file_path, file_size, recipient_email,
      wrapped_key, wrapped_key_salt, otp_hash, expiry_type, expiry_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    fileId, fileName, filePath, fileSize, recipientEmail,
    wrappedKey, wrappedKeySalt, otpHash, expiryType, expiryTime.toISOString()
  ]);

  return result.lastID;
}

/**
 * Get file record by fileId
 */
export async function getFileById(fileId) {
  const db = await getDatabase();

  return await db.get(`
    SELECT * FROM files WHERE file_id = ? AND status = 'active'
  `, fileId);
}

/**
 * Update file status
 */
export async function updateFileStatus(fileId, status, additionalData = {}) {
  const db = await getDatabase();

  const updates = [];
  const values = [];

  if (status) {
    updates.push('status = ?');
    values.push(status);
  }

  if (additionalData.downloadedAt) {
    updates.push('downloaded_at = ?');
    values.push(additionalData.downloadedAt);
  }

  if (additionalData.otpAttempts !== undefined) {
    updates.push('otp_attempts = ?');
    values.push(additionalData.otpAttempts);
  }

  if (additionalData.lastAttemptAt) {
    updates.push('last_attempt_at = ?');
    values.push(additionalData.lastAttemptAt);
  }

  if (updates.length === 0) return;

  values.push(fileId);

  await db.run(`
    UPDATE files SET ${updates.join(', ')} WHERE file_id = ?
  `, values);
}

/**
 * Increment OTP attempts counter
 */
export async function incrementOTPAttempts(fileId) {
  const db = await getDatabase();

  await db.run(`
    UPDATE files SET
      otp_attempts = otp_attempts + 1,
      last_attempt_at = ?
    WHERE file_id = ?
  `, [new Date().toISOString(), fileId]);
}

/**
 * Check if file is expired
 */
export async function isFileExpired(fileId) {
  const db = await getDatabase();

  const file = await db.get(`
    SELECT expiry_time, status FROM files WHERE file_id = ?
  `, fileId);

  if (!file) return true;

  const now = new Date();
  const expiryTime = new Date(file.expiry_time);

  return now > expiryTime || file.status !== 'active';
}

/**
 * Clean up expired files (should be run periodically)
 */
export async function cleanupExpiredFiles() {
  const db = await getDatabase();

  const expiredFiles = await db.all(`
    SELECT file_id, file_path FROM files
    WHERE status = 'active' AND expiry_time < ?
  `, new Date().toISOString());

  // Mark as expired in database
  await db.run(`
    UPDATE files SET status = 'expired' WHERE expiry_time < ?
  `, new Date().toISOString());

  // Log cleanup
  await logAuditEvent(null, 'expired', null, null, {
    expiredCount: expiredFiles.length,
    files: expiredFiles.map(f => f.file_id)
  });

  console.log(`🧹 Cleaned up ${expiredFiles.length} expired files`);
  return expiredFiles.length;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log an audit event
 */
export async function logAuditEvent(fileId, eventType, ipAddress, userAgent, details = {}) {
  if (!process.env.AUDIT_LOG_ENABLED || process.env.AUDIT_LOG_ENABLED === 'false') {
    return;
  }

  try {
    const db = await getDatabase();

    await db.run(`
      INSERT INTO audit_logs (file_id, event_type, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      fileId,
      eventType,
      ipAddress,
      userAgent,
      JSON.stringify(details)
    ]);
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging shouldn't break the main flow
  }
}

/**
 * Get audit logs for a file
 */
export async function getFileAuditLogs(fileId, limit = 50) {
  const db = await getDatabase();

  return await db.all(`
    SELECT * FROM audit_logs
    WHERE file_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [fileId, limit]);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  const db = await getDatabase();

  const stats = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM files WHERE status = 'active') as active_files,
      (SELECT COUNT(*) FROM files WHERE status = 'used') as used_files,
      (SELECT COUNT(*) FROM files WHERE status = 'expired') as expired_files,
      (SELECT COUNT(*) FROM audit_logs) as total_logs,
      (SELECT SUM(file_size) FROM files WHERE status = 'active') as total_size_bytes
  `);

  return stats;
}

/**
 * Health check for database
 */
export async function healthCheck() {
  try {
    const db = await getDatabase();
    await db.get('SELECT 1 as health_check');
    return { status: 'healthy', database: 'connected' };
  } catch (error) {
    return { status: 'unhealthy', database: 'disconnected', error: error.message };
  }
}