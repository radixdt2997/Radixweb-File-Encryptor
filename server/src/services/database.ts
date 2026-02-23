/**
 * Database Service - PostgreSQL (Phase 6)
 *
 * Uses pg (node-postgres) with DATABASE_URL. Migrations run on init.
 */

import { Pool } from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  database as dbConfig,
  encryption as encryptionConfig,
  logging as loggingConfig,
} from "../config";
import { decryptDbField, encryptDbField } from "../lib/encryption";
import { runMigrations } from "./runMigrations";
import type {
  FileRecord,
  RecipientRecord,
  UserRecord,
  CreateFileData,
  CreateRecipientData,
  UpdateFileStatusData,
  DatabaseHealthCheck,
} from "../types/database";
import {
  ExpiryType,
  FileStatus,
  TransactionRole,
  UserRole,
} from "../types/database";
import { HealthStatus, type DatabaseStats } from "../types/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Version byte for encryption-at-rest */
const DB_ENCRYPTED_VERSION = 0x01;

function encryptForDb(plain: Buffer): Buffer {
  if (!encryptionConfig.enabled || !encryptionConfig.masterKey) return plain;
  return Buffer.concat([
    Buffer.from([DB_ENCRYPTED_VERSION]),
    encryptDbField(plain),
  ]);
}

function decryptFromDb(stored: Buffer): Buffer {
  if (stored.length > 0 && stored[0] === DB_ENCRYPTED_VERSION) {
    return decryptDbField(stored.subarray(1));
  }
  return stored;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!dbConfig.databaseUrl || dbConfig.databaseUrl.trim() === "") {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString: dbConfig.databaseUrl });
  }
  return pool;
}

function decryptFileRecord(
  raw: FileRecord & { wrapped_key: Buffer; wrapped_key_salt: Buffer },
): FileRecord {
  return {
    ...raw,
    wrapped_key: decryptFromDb(raw.wrapped_key),
    wrapped_key_salt: decryptFromDb(raw.wrapped_key_salt),
  };
}

function decryptRecipientRecord(
  raw: RecipientRecord & { wrapped_key: Buffer; wrapped_key_salt: Buffer },
): RecipientRecord {
  return {
    ...raw,
    wrapped_key: decryptFromDb(raw.wrapped_key),
    wrapped_key_salt: decryptFromDb(raw.wrapped_key_salt),
  };
}

/**
 * Initialize database (run migrations, ensure storage dir)
 */
export async function initDatabase(): Promise<boolean> {
  getPool(); // ensure pool exists
  await runMigrations();
  const dataDir = path.join(__dirname, "../../data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  console.log("✅ PostgreSQL database initialized");
  return true;
}

/**
 * Create a new file record
 */
export async function createFileRecord(
  data: CreateFileData,
): Promise<number | string> {
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
    uploadedByUserId = null,
  } = data;

  const expiryTime = new Date(
    Date.now() + expiryMinutes * 60 * 1000,
  ).toISOString();

  const wrappedKeyBuf = Buffer.isBuffer(wrappedKey)
    ? wrappedKey
    : Buffer.from(wrappedKey);
  const wrappedKeySaltBuf = Buffer.isBuffer(wrappedKeySalt)
    ? wrappedKeySalt
    : Buffer.from(wrappedKeySalt);
  const storedWrappedKey = encryptForDb(wrappedKeyBuf);
  const storedWrappedKeySalt = encryptForDb(wrappedKeySaltBuf);

  const p = getPool();
  const result = await p.query(
    `INSERT INTO files (
      file_id, file_name, file_path, file_size, recipient_email,
      wrapped_key, wrapped_key_salt, otp_hash, expiry_type, expiry_time, uploaded_by_user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      fileId,
      fileName,
      filePath,
      fileSize,
      recipientEmail,
      storedWrappedKey,
      storedWrappedKeySalt,
      otpHash,
      expiryType,
      expiryTime,
      uploadedByUserId,
    ],
  );
  return result.rows[0].id;
}

/**
 * Get file record by fileId
 */
export async function getFileRecord(
  fileId: string,
): Promise<FileRecord | null> {
  const p = getPool();
  const result = await p.query("SELECT * FROM files WHERE file_id = $1", [
    fileId,
  ]);
  const row = result.rows[0];
  if (!row) return null;
  const raw = {
    ...row,
    status: row.status as FileStatus,
    expiry_type: row.expiry_type as ExpiryType,
  } as FileRecord & { wrapped_key: Buffer; wrapped_key_salt: Buffer };
  return decryptFileRecord(raw);
}

export async function getFileById(fileId: string): Promise<FileRecord | null> {
  return getFileRecord(fileId);
}

/**
 * Update file status
 */
export async function updateFileStatus(
  fileId: string,
  status: FileStatus | null,
  additionalData: UpdateFileStatusData = {},
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (status) {
    updates.push(`status = $${i++}`);
    values.push(status);
  }
  if (additionalData.downloadedAt) {
    updates.push(`downloaded_at = $${i++}`);
    values.push(additionalData.downloadedAt);
  }
  if (additionalData.otpAttempts !== undefined) {
    updates.push(`otp_attempts = $${i++}`);
    values.push(additionalData.otpAttempts);
  }
  if (additionalData.lastAttemptAt) {
    updates.push(`last_attempt_at = $${i++}`);
    values.push(additionalData.lastAttemptAt);
  }

  if (updates.length === 0) return;

  values.push(fileId);
  const p = getPool();
  await p.query(
    `UPDATE files SET ${updates.join(", ")} WHERE file_id = $${i}`,
    values,
  );
}

export async function isFileExpired(fileId: string): Promise<boolean> {
  const file = await getFileRecord(fileId);
  if (!file) return true;
  const now = new Date();
  const expiryTime = new Date(file.expiry_time);
  return now > expiryTime || file.status !== FileStatus.Active;
}

export async function healthCheck(): Promise<DatabaseHealthCheck> {
  try {
    const p = getPool();
    await p.query("SELECT 1");
    return { status: HealthStatus.Healthy, database: "connected" };
  } catch (error) {
    const err = error as Error;
    return {
      status: HealthStatus.Unhealthy,
      database: "disconnected",
      error: err.message,
    };
  }
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const p = getPool();
  const [activeRes, usedRes, expiredRes, sizeRes, logsRes] = await Promise.all([
    p.query(`SELECT COUNT(*)::int AS count FROM files WHERE status = $1`, [FileStatus.Active]),
    p.query(`SELECT COUNT(*)::int AS count FROM files WHERE status = $1`, [FileStatus.Used]),
    p.query(`SELECT COUNT(*)::int AS count FROM files WHERE status = $1`, [FileStatus.Expired]),
    p.query(
      `SELECT COALESCE(SUM(file_size), 0)::bigint AS total FROM files WHERE status = $1`,
    [FileStatus.Active],
    ),
    p.query("SELECT COUNT(*)::int AS count FROM audit_logs"),
  ]);
  return {
    active_files: Number(activeRes.rows[0].count),
    used_files: Number(usedRes.rows[0].count),
    expired_files: Number(expiredRes.rows[0].count),
    total_logs: Number(logsRes.rows[0].count),
    total_size_bytes: Number(sizeRes.rows[0].total),
  };
}

export async function incrementOTPAttempts(fileId: string): Promise<void> {
  const p = getPool();
  await p.query(
    `UPDATE files SET otp_attempts = otp_attempts + 1, last_attempt_at = NOW() WHERE file_id = $1`,
    [fileId],
  );
}

export async function updateFileRecord(
  fileId: string,
  updates: Partial<FileRecord>,
): Promise<void> {
  const keys = Object.keys(updates).filter(
    (k) => k !== "file_id" && updates[k as keyof FileRecord] !== undefined,
  );
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k as keyof FileRecord]);
  values.push(fileId);
  const p = getPool();
  await p.query(
    `UPDATE files SET ${setClause} WHERE file_id = $${keys.length + 1}`,
    values,
  );
}

export async function createRecipientRecord(
  data: CreateRecipientData,
): Promise<string> {
  const id = data.id ?? crypto.randomUUID();
  const {
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

  const wrappedKeyBuffer =
    typeof wrappedKey === "string"
      ? Buffer.from(wrappedKey, "base64")
      : wrappedKey;
  const wrappedKeySaltBuffer =
    typeof wrappedKeySalt === "string"
      ? Buffer.from(wrappedKeySalt, "base64")
      : wrappedKeySalt;
  const storedWrappedKey = encryptForDb(wrappedKeyBuffer);
  const storedWrappedKeySalt = encryptForDb(wrappedKeySaltBuffer);

  const p = getPool();
  await p.query(
    `INSERT INTO recipients (
      id, file_id, email, otp_hash, wrapped_key, wrapped_key_salt,
      otp_verified_at, downloaded_at, otp_attempts, last_attempt_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
    [
      id,
      fileId,
      email,
      otpHash,
      storedWrappedKey,
      storedWrappedKeySalt,
      otpVerifiedAt,
      downloadedAt,
      otpAttempts,
      lastAttemptAt,
    ],
  );
  return id;
}

export async function getRecipientsByFileId(
  fileId: string,
): Promise<RecipientRecord[]> {
  const p = getPool();
  const result = await p.query(
    "SELECT * FROM recipients WHERE file_id = $1 ORDER BY created_at ASC",
    [fileId],
  );
  return result.rows.map((row: Record<string, unknown>) =>
    decryptRecipientRecord({
      ...row,
      wrapped_key: row.wrapped_key as Buffer,
      wrapped_key_salt: row.wrapped_key_salt as Buffer,
    } as RecipientRecord & { wrapped_key: Buffer; wrapped_key_salt: Buffer }),
  );
}

export async function getRecipientByFileAndEmail(
  fileId: string,
  email: string,
): Promise<RecipientRecord | null> {
  const p = getPool();
  const result = await p.query(
    "SELECT * FROM recipients WHERE file_id = $1 AND email = $2",
    [fileId, email],
  );
  const row = result.rows[0];
  if (!row) return null;
  return decryptRecipientRecord({
    ...row,
    wrapped_key: row.wrapped_key as Buffer,
    wrapped_key_salt: row.wrapped_key_salt as Buffer,
  } as RecipientRecord & { wrapped_key: Buffer; wrapped_key_salt: Buffer });
}

export async function updateRecipientRecord(
  recipientId: string,
  updates: Partial<RecipientRecord>,
): Promise<void> {
  const keys = Object.keys(updates).filter(
    (k) => k !== "id" && updates[k as keyof RecipientRecord] !== undefined,
  );
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k as keyof RecipientRecord]);
  values.push(recipientId);
  const p = getPool();
  await p.query(
    `UPDATE recipients SET ${setClause} WHERE id = $${keys.length + 1}`,
    values,
  );
}

export async function deleteRecipient(
  fileId: string,
  recipientId: string,
): Promise<void> {
  const p = getPool();
  await p.query("DELETE FROM recipients WHERE id = $1 AND file_id = $2", [
    recipientId,
    fileId,
  ]);
}

export async function incrementRecipientOTPAttempts(
  recipientId: string,
): Promise<void> {
  const p = getPool();
  await p.query(
    `UPDATE recipients SET otp_attempts = otp_attempts + 1, last_attempt_at = NOW() WHERE id = $1`,
    [recipientId],
  );
}

export async function logAuditEvent(
  fileId: string,
  eventType: string,
  ipAddress: string | null,
  userAgent: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  if (!loggingConfig.auditEnabled) return;
  const p = getPool();
  await p.query(
    `INSERT INTO audit_logs (file_id, event_type, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [fileId, eventType, ipAddress, userAgent, JSON.stringify(details)],
  );
}

export async function logRecipientAuditEvent(
  fileId: string,
  recipientId: string,
  eventType: string,
  ipAddress: string | null,
  userAgent: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  if (!loggingConfig.auditEnabled) return;
  const p = getPool();
  await p.query(
    `INSERT INTO recipient_audit_logs (id, file_id, recipient_id, event_type, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      crypto.randomUUID(),
      fileId,
      recipientId,
      eventType,
      ipAddress,
      userAgent,
      JSON.stringify(details),
    ],
  );
}

export function closeDatabase(): void {
  if (pool) {
    pool.end();
    pool = null;
  }
}

// ============================================================================
// USER (AUTH) - Phase 6
// ============================================================================

export async function createUser(data: {
  email: string;
  passwordHash: string;
  role: UserRole;
}): Promise<UserRecord> {
  const p = getPool();
  const result = await p.query(
    `INSERT INTO users (email, password_hash, role, updated_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, email, password_hash, role, created_at, updated_at`,
    [data.email.toLowerCase().trim(), data.passwordHash, data.role],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getUserByEmail(
  email: string,
): Promise<UserRecord | null> {
  const p = getPool();
  const result = await p.query(
    "SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE email = $1",
    [email.toLowerCase().trim()],
  );
  const row = result.rows[0];
  return row ?? null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const p = getPool();
  const result = await p.query(
    "SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  return row ?? null;
}

// ============================================================================
// TRANSACTIONS (Phase 6) – list files for "My transactions" / "All transactions"
// ============================================================================

export interface TransactionRow {
  file_id: string;
  file_name: string;
  created_at: string;
  expiry_time: string;
  status: string;
  recipient_count: number;
  role: TransactionRole;
}

export async function getTransactions(
  userId: string,
  userEmail: string,
  isAdmin: boolean,
  options: {
    page: number;
    limit: number;
    scope?: "all";
    type?: "sent" | "received";
  },
): Promise<{ items: TransactionRow[]; total: number }> {
  const p = getPool();
  const { page, limit, scope, type } = options;
  const offset = (page - 1) * limit;

  if (isAdmin && scope === "all") {
    const countResult = await p.query(
      "SELECT COUNT(*)::int AS total FROM files",
    );
    const total = countResult.rows[0].total as number;
    const result = await p.query(
      `SELECT f.file_id, f.file_name, f.created_at, f.expiry_time, f.status,
              (SELECT COUNT(*)::int FROM recipients r WHERE r.file_id = f.file_id) AS recipient_count
       FROM files f
       ORDER BY f.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const items: TransactionRow[] = result.rows.map(
      (row: Record<string, unknown>) => ({
        file_id: String(row.file_id),
        file_name: String(row.file_name),
        created_at: String(row.created_at),
        expiry_time: String(row.expiry_time),
        status: String(row.status),
        recipient_count: Number(row.recipient_count) || 0,
        role: TransactionRole.Sender,
      }),
    );
    return { items, total };
  }

  const sentCondition = "f.uploaded_by_user_id = $1";
  const receivedCondition1 =
    "EXISTS (SELECT 1 FROM recipients r WHERE r.file_id = f.file_id AND r.email = $1)";
  const receivedCondition2 =
    "EXISTS (SELECT 1 FROM recipients r WHERE r.file_id = f.file_id AND r.email = $2)";

  let whereClause: string;
  const params: unknown[] = [];

  if (type === "sent") {
    whereClause = sentCondition;
    params.push(userId);
  } else if (type === "received") {
    whereClause = receivedCondition1;
    params.push(userEmail);
  } else {
    whereClause = `(${sentCondition} OR ${receivedCondition2})`;
    params.push(userId, userEmail);
  }

  const countResult = await p.query(
    `SELECT COUNT(*)::int AS total FROM files f WHERE ${whereClause}`,
    params,
  );
  const total = countResult.rows[0].total as number;

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const result = await p.query(
    `SELECT f.file_id, f.file_name, f.created_at, f.expiry_time, f.status, f.uploaded_by_user_id,
            (SELECT COUNT(*)::int FROM recipients r WHERE r.file_id = f.file_id) AS recipient_count
     FROM files f
     WHERE ${whereClause}
     ORDER BY f.created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [...params, limit, offset],
  );

  const items: TransactionRow[] = result.rows.map(
    (row: Record<string, unknown>) => {
      const role =
        row.uploaded_by_user_id === userId
          ? TransactionRole.Sender
          : TransactionRole.Recipient;
      return {
        file_id: String(row.file_id),
        file_name: String(row.file_name),
        created_at: String(row.created_at),
        expiry_time: String(row.expiry_time),
        status: String(row.status),
        recipient_count: Number(row.recipient_count) || 0,
        role,
      };
    },
  );

  return { items, total };
}
