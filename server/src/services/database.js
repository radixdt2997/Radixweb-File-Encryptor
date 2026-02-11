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
import { v4 as uuidv4 } from "uuid";

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment-based database selection
const USE_SQLITE =
  process.env.NODE_ENV === "production" || process.env.USE_SQLITE === "true";

// SQLite database instance
let db = null;
if (USE_SQLITE) {
  const dbPath = path.join(__dirname, "../../data/secure-files.db");

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);

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

  db.exec(`
        CREATE TABLE IF NOT EXISTS recipients (
            id TEXT PRIMARY KEY,
            file_id TEXT NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            otp_hash TEXT NOT NULL,
            wrapped_key TEXT NOT NULL,
            wrapped_key_salt TEXT NOT NULL,
            otp_verified_at DATETIME,
            downloaded_at DATETIME,
            otp_attempts INTEGER DEFAULT 0,
            last_attempt_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  db.exec(`
        CREATE TABLE IF NOT EXISTS recipient_audit_logs (
            id TEXT PRIMARY KEY,
            file_id TEXT NOT NULL,
            recipient_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Ensure new recipient-related columns exist on files table (idempotent)
  function ensureColumnExists(tableName, columnName, columnDef) {
    const infoStmt = db.prepare(`PRAGMA table_info(${tableName})`);
    const columns = infoStmt.all();
    const exists = columns.some((col) => col.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    }
  }

  ensureColumnExists("files", "total_recipients", "INTEGER DEFAULT 1");
  ensureColumnExists("files", "verified_recipients", "INTEGER DEFAULT 0");
  ensureColumnExists("files", "downloaded_recipients", "INTEGER DEFAULT 0");

  // One-time migration: move legacy single-recipient data into recipients table
  const filesToMigrateStmt = db.prepare(`
        SELECT * FROM files
        WHERE recipient_email IS NOT NULL
          AND file_id NOT IN (SELECT DISTINCT file_id FROM recipients)
    `);

  const legacyFiles = filesToMigrateStmt.all();

  if (legacyFiles.length > 0) {
    const insertRecipientStmt = db.prepare(`
            INSERT INTO recipients (
                id,
                file_id,
                email,
                otp_hash,
                wrapped_key,
                wrapped_key_salt,
                otp_verified_at,
                downloaded_at,
                otp_attempts,
                last_attempt_at,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    const updateFileCountersStmt = db.prepare(`
            UPDATE files
            SET total_recipients = 1,
                verified_recipients = CASE WHEN downloaded_at IS NOT NULL THEN 1 ELSE 0 END,
                downloaded_recipients = CASE WHEN downloaded_at IS NOT NULL THEN 1 ELSE 0 END
            WHERE file_id = ?
        `);

    const migrateTxn = db.transaction((rows) => {
      for (const file of rows) {
        const recipientId = uuidv4();

        insertRecipientStmt.run(
          recipientId,
          file.file_id,
          file.recipient_email,
          file.otp_hash,
          file.wrapped_key,
          file.wrapped_key_salt,
          null, // otp_verified_at - unknown for legacy, keep null
          file.downloaded_at || null,
          file.otp_attempts ?? 0,
          file.last_attempt_at || null,
          file.created_at || new Date().toISOString(),
        );

        updateFileCountersStmt.run(file.file_id);
      }
    });

    migrateTxn(legacyFiles);
  }
}

// In-memory storage for development
const files = new Map();
const auditLogs = [];
const recipients = new Map(); // recipientId -> recipient record
const recipientAuditLogs = [];

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
 * Create a recipient record
 */
export async function createRecipientRecord(data) {
  const {
    id = uuidv4(),
    fileId,
    email,
    otpHash,
    wrappedKey,
    wrappedKeySalt,
    otpVerifiedAt = null,
    downloadedAt = null,
    otpAttempts = 0,
    lastAttemptAt = null,
  } = data;

  const createdAt = new Date().toISOString();

  if (USE_SQLITE) {
    const stmt = db.prepare(`
      INSERT INTO recipients (
        id,
        file_id,
        email,
        otp_hash,
        wrapped_key,
        wrapped_key_salt,
        otp_verified_at,
        downloaded_at,
        otp_attempts,
        last_attempt_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      fileId,
      email,
      otpHash,
      wrappedKey,
      wrappedKeySalt,
      otpVerifiedAt,
      downloadedAt,
      otpAttempts,
      lastAttemptAt,
      createdAt,
    );
  } else {
    const record = {
      id,
      file_id: fileId,
      email,
      otp_hash: otpHash,
      wrapped_key: wrappedKey,
      wrapped_key_salt: wrappedKeySalt,
      otp_verified_at: otpVerifiedAt,
      downloaded_at: downloadedAt,
      otp_attempts: otpAttempts,
      last_attempt_at: lastAttemptAt,
      created_at: createdAt,
    };
    recipients.set(id, record);
  }

  return id;
}

/**
 * Get all recipients for a file
 */
export async function getRecipientsByFileId(fileId) {
  if (USE_SQLITE) {
    const stmt = db.prepare(
      "SELECT * FROM recipients WHERE file_id = ? ORDER BY created_at ASC",
    );
    return stmt.all(fileId);
  } else {
    return Array.from(recipients.values()).filter(
      (r) => r.file_id === fileId,
    );
  }
}

/**
 * Get recipient by fileId and email
 */
export async function getRecipientByFileAndEmail(fileId, email) {
  if (USE_SQLITE) {
    const stmt = db.prepare(
      "SELECT * FROM recipients WHERE file_id = ? AND email = ?",
    );
    return stmt.get(fileId, email) || null;
  } else {
    return (
      Array.from(recipients.values()).find(
        (r) => r.file_id === fileId && r.email === email,
      ) || null
    );
  }
}

/**
 * Update recipient record
 */
export async function updateRecipientRecord(recipientId, updates) {
  if (USE_SQLITE) {
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = Object.values(updates);
    const stmt = db.prepare(
      `UPDATE recipients SET ${fields} WHERE id = ?`,
    );
    stmt.run(...values, recipientId);
  } else {
    const recipient = recipients.get(recipientId);
    if (!recipient) return;
    Object.assign(recipient, updates);
    recipients.set(recipientId, recipient);
  }
}

/**
 * Delete recipient (used for access revocation)
 */
export async function deleteRecipient(fileId, recipientId) {
  if (USE_SQLITE) {
    const stmt = db.prepare(
      "DELETE FROM recipients WHERE id = ? AND file_id = ?",
    );
    stmt.run(recipientId, fileId);
  } else {
    const recipient = recipients.get(recipientId);
    if (!recipient || recipient.file_id !== fileId) return;
    recipients.delete(recipientId);
  }
}

/**
 * Increment recipient OTP attempts counter
 */
export async function incrementRecipientOTPAttempts(recipientId) {
  if (USE_SQLITE) {
    const stmt = db.prepare(`
      UPDATE recipients 
      SET otp_attempts = otp_attempts + 1, last_attempt_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(recipientId);
  } else {
    const recipient = recipients.get(recipientId);
    if (!recipient) return;
    recipient.otp_attempts = (recipient.otp_attempts || 0) + 1;
    recipient.last_attempt_at = new Date().toISOString();
    recipients.set(recipientId, recipient);
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
 * Log recipient audit event
 */
export async function logRecipientAuditEvent(
  fileId,
  recipientId,
  eventType,
  ipAddress,
  userAgent,
  details = {},
) {
  if (USE_SQLITE) {
    const stmt = db.prepare(`
      INSERT INTO recipient_audit_logs (
        id,
        file_id,
        recipient_id,
        event_type,
        ip_address,
        user_agent,
        details
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuidv4(),
      fileId,
      recipientId,
      eventType,
      ipAddress,
      userAgent,
      JSON.stringify(details),
    );
  } else {
    const logEntry = {
      id: uuidv4(),
      file_id: fileId,
      recipient_id: recipientId,
      event_type: eventType,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: JSON.stringify(details),
      created_at: new Date().toISOString(),
    };

    recipientAuditLogs.push(logEntry);
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
