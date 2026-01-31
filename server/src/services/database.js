/**
 * Database Service - Hybrid Implementation
 *
 * Uses in-memory storage for development and SQLite for production.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment-based database selection
const USE_SQLITE =
  process.env.NODE_ENV === "production" || process.env.USE_SQLITE === "true";

// SQLite database instance
let db = null;
if (USE_SQLITE) {
  db = new Database("secure_files.db");

  // Create tables
  db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            recipient_email TEXT NOT NULL,
            wrapped_key TEXT NOT NULL,
            wrapped_key_salt TEXT NOT NULL,
            otp_hash TEXT NOT NULL,
            expiry_type TEXT NOT NULL,
            expiry_time DATETIME NOT NULL,
            status TEXT DEFAULT 'active',
            otp_attempts INTEGER DEFAULT 0,
            last_attempt_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            downloaded_at DATETIME
        )
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// In-memory storage for development
const files = new Map();
const auditLogs = [];

/**
 * Initialize database
 */
export async function initDatabase() {
  try {
    if (!USE_SQLITE) {
      // Ensure data directory exists for file storage
      const dataDir = path.join(__dirname, "../../data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      console.log("✅ In-memory database initialized");
    } else {
      console.log("✅ SQLite database initialized");
    }
    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

/**
 * Create a new file record
 */
export async function createFileRecord(data) {
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
    expiryType,
  } = data;

  const expiryTime = new Date(
    Date.now() + expiryMinutes * 60 * 1000,
  ).toISOString();

  const record = {
    file_id: fileId,
    file_name: fileName,
    file_path: filePath,
    file_size: fileSize,
    recipient_email: recipientEmail,
    wrapped_key: wrappedKey,
    wrapped_key_salt: wrappedKeySalt,
    otp_hash: otpHash,
    expiry_type: expiryType,
    expiry_time: expiryTime,
    status: "active",
    otp_attempts: 0,
    last_attempt_at: null,
    created_at: new Date().toISOString(),
    downloaded_at: null,
  };

  if (USE_SQLITE) {
    const stmt = db.prepare(`
      INSERT INTO files (file_id, file_name, file_path, file_size, recipient_email, 
                        wrapped_key, wrapped_key_salt, otp_hash, expiry_type, expiry_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      fileId,
      fileName,
      filePath,
      fileSize,
      recipientEmail,
      wrappedKey,
      wrappedKeySalt,
      otpHash,
      expiryType,
      expiryTime,
    );
    return result.lastInsertRowid;
  } else {
    record.id = Date.now();
    files.set(fileId, record);
    return record.id;
  }
}

/**
 * Get file record by fileId
 */
export async function getFileRecord(fileId) {
  if (USE_SQLITE) {
    const stmt = db.prepare("SELECT * FROM files WHERE file_id = ?");
    return stmt.get(fileId) || null;
  } else {
    return files.get(fileId) || null;
  }
}

/**
 * Get file record by fileId (alias)
 */
export async function getFileById(fileId) {
  return getFileRecord(fileId);
}

/**
 * Update file status
 */
export async function updateFileStatus(fileId, status, additionalData = {}) {
  if (USE_SQLITE) {
    const updates = [];
    const values = [];

    if (status) {
      updates.push("status = ?");
      values.push(status);
    }

    if (additionalData.downloadedAt) {
      updates.push("downloaded_at = ?");
      values.push(additionalData.downloadedAt);
    }

    if (additionalData.otpAttempts !== undefined) {
      updates.push("otp_attempts = ?");
      values.push(additionalData.otpAttempts);
    }

    if (additionalData.lastAttemptAt) {
      updates.push("last_attempt_at = ?");
      values.push(additionalData.lastAttemptAt);
    }

    if (updates.length > 0) {
      const stmt = db.prepare(
        `UPDATE files SET ${updates.join(", ")} WHERE file_id = ?`,
      );
      stmt.run(...values, fileId);
    }
  } else {
    const file = files.get(fileId);
    if (!file) return;

    if (status) {
      file.status = status;
    }

    if (additionalData.downloadedAt) {
      file.downloaded_at = additionalData.downloadedAt;
    }

    if (additionalData.otpAttempts !== undefined) {
      file.otp_attempts = additionalData.otpAttempts;
    }

    if (additionalData.lastAttemptAt) {
      file.last_attempt_at = additionalData.lastAttemptAt;
    }

    files.set(fileId, file);
  }
}

/**
 * Check if file is expired
 */
export async function isFileExpired(fileId) {
  const file = await getFileRecord(fileId);
  if (!file) return true;

  const now = new Date();
  const expiryTime = new Date(file.expiry_time);

  return now > expiryTime || file.status !== "active";
}

/**
 * Health check for database
 */
export async function healthCheck() {
  try {
    if (USE_SQLITE) {
      db.prepare("SELECT 1").get();
    }
    return { status: "healthy", database: "connected" };
  } catch (error) {
    return {
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    };
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  if (USE_SQLITE) {
    const activeStmt = db.prepare(
      "SELECT COUNT(*) as count FROM files WHERE status = 'active'",
    );
    const usedStmt = db.prepare(
      "SELECT COUNT(*) as count FROM files WHERE status = 'used'",
    );
    const expiredStmt = db.prepare(
      "SELECT COUNT(*) as count FROM files WHERE status = 'expired'",
    );
    const sizeStmt = db.prepare(
      "SELECT SUM(file_size) as total FROM files WHERE status = 'active'",
    );
    const logsStmt = db.prepare("SELECT COUNT(*) as count FROM audit_logs");

    return {
      active_files: activeStmt.get().count,
      used_files: usedStmt.get().count,
      expired_files: expiredStmt.get().count,
      total_logs: logsStmt.get().count,
      total_size_bytes: sizeStmt.get().total || 0,
    };
  } else {
    const allFiles = Array.from(files.values());

    return {
      active_files: allFiles.filter((f) => f.status === "active").length,
      used_files: allFiles.filter((f) => f.status === "used").length,
      expired_files: allFiles.filter((f) => f.status === "expired").length,
      total_logs: auditLogs.length,
      total_size_bytes: allFiles
        .filter((f) => f.status === "active")
        .reduce((sum, f) => sum + f.file_size, 0),
    };
  }
}

/**
 * Increment OTP attempts counter
 */
export async function incrementOTPAttempts(fileId) {
  if (USE_SQLITE) {
    const stmt = db.prepare(`
      UPDATE files 
      SET otp_attempts = otp_attempts + 1, last_attempt_at = CURRENT_TIMESTAMP 
      WHERE file_id = ?
    `);
    stmt.run(fileId);
  } else {
    const file = files.get(fileId);
    if (!file) return;

    file.otp_attempts = (file.otp_attempts || 0) + 1;
    file.last_attempt_at = new Date().toISOString();

    files.set(fileId, file);
  }
}

/**
 * Update file record
 */
export async function updateFileRecord(fileId, updates) {
  if (USE_SQLITE) {
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = Object.values(updates);
    const stmt = db.prepare(`UPDATE files SET ${fields} WHERE file_id = ?`);
    stmt.run(...values, fileId);
  } else {
    const file = files.get(fileId);
    if (!file) return;

    Object.assign(file, updates);
    files.set(fileId, file);
  }
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  fileId,
  eventType,
  ipAddress,
  userAgent,
  details = {},
) {
  if (USE_SQLITE) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (file_id, event_type, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(fileId, eventType, ipAddress, userAgent, JSON.stringify(details));
  } else {
    const logEntry = {
      id: Date.now() + Math.random(),
      file_id: fileId,
      event_type: eventType,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: JSON.stringify(details),
      created_at: new Date().toISOString(),
    };

    auditLogs.push(logEntry);
  }
}

/**
 * Get database instance (for compatibility)
 */
export function getDatabase() {
  if (USE_SQLITE) {
    return db;
  } else {
    return { files, auditLogs };
  }
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (USE_SQLITE && db) {
    db.close();
  }
}
