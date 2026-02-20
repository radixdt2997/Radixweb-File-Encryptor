/**
 * File Storage Service
 *
 * Handles secure storage and retrieval of encrypted files.
 * Currently implements local disk storage, easily extensible to S3/cloud storage.
 */

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { encryption, storage } from "../config";
import {
  decryptFilePayload,
  encryptFilePayload,
  ENCRYPTED_HEADER_LENGTH,
} from "../lib/encryption";
import type {
  FileStorageResult,
  FileMetadata,
  StorageHealthCheck,
} from "../types/services";
import type { StorageStats } from "../types/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration from config module
const STORAGE_PATH = path.isAbsolute(storage.path)
  ? storage.path
  : path.join(__dirname, "../..", storage.path);
const MAX_FILE_SIZE = storage.maxFileSize;
const FILE_RETENTION_DAYS = storage.retentionDays;

// ============================================================================
// DIRECTORY MANAGEMENT
// ============================================================================

/**
 * Ensure all required directories exist
 */
export async function ensureDirectories(): Promise<void> {
  const dirs = [
    STORAGE_PATH,
    path.join(__dirname, "../../data"),
    path.join(__dirname, "../../logs"),
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "EEXIST") {
        throw error;
      }
    }
  }
}

/**
 * Generate unique filename for stored file
 */
function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const extension = path.extname(originalFilename) || ".enc";
  return `${timestamp}-${random}${extension}`;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Save uploaded encrypted file to storage
 */
export async function saveFile(
  fileBuffer: Buffer,
  originalFilename: string,
  _metadata: Record<string, unknown> = {},
): Promise<FileStorageResult> {
  try {
    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(
        `File size ${fileBuffer.length} exceeds maximum ${MAX_FILE_SIZE}`,
      );
    }

    // Generate unique filename
    const filename = generateUniqueFilename(originalFilename);
    const filePath = path.join(STORAGE_PATH, filename);

    // Encrypt at rest when enabled (payload written to disk may be larger)
    const payloadToWrite =
      encryption.enabled && encryption.masterKey
        ? encryptFilePayload(fileBuffer)
        : fileBuffer;

    // Write file to disk
    await fs.writeFile(filePath, payloadToWrite);

    // Verify file was written correctly
    const stats = await fs.stat(filePath);
    if (stats.size !== payloadToWrite.length) {
      throw new Error("File write verification failed");
    }

    console.log(`💾 Saved file: ${filename} (${fileBuffer.length} bytes)`);

    return {
      filename,
      path: filePath,
      size: fileBuffer.length,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to save file:", error);
    throw error;
  }
}

/**
 * Read file from storage
 */
export async function readFile(filename: string): Promise<Buffer> {
  try {
    const filePath = path.join(STORAGE_PATH, filename);

    // Check if file exists
    await fs.access(filePath);

    // Read file
    const raw = await fs.readFile(filePath);

    // Decrypt at rest when enabled and payload looks like our encrypted format
    if (
      encryption.enabled &&
      encryption.masterKey &&
      raw.length >= ENCRYPTED_HEADER_LENGTH
    ) {
      const decrypted = decryptFilePayload(raw);
      if (decrypted !== raw) return decrypted;
    }

    return raw;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error("File not found");
    }
    console.error("Failed to read file:", error);
    throw error;
  }
}

/**
 * Delete file from storage
 */
export async function deleteFile(filename: string): Promise<boolean> {
  try {
    const filePath = path.join(STORAGE_PATH, filename);
    await fs.unlink(filePath);
    console.log(`🗑️  Deleted file: ${filename}`);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.warn(`File not found for deletion: ${filename}`);
      return false;
    }
    console.error("Failed to delete file:", error);
    throw error;
  }
}

/**
 * Get file metadata without reading content
 */
export async function getFileMetadata(filename: string): Promise<FileMetadata> {
  try {
    const filePath = path.join(STORAGE_PATH, filename);
    const stats = await fs.stat(filePath);

    return {
      filename,
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      exists: true,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return { filename, path: path.join(STORAGE_PATH, filename), size: 0, createdAt: new Date(), modifiedAt: new Date(), exists: false };
    }
    throw error;
  }
}

// ============================================================================
// CLEANUP OPERATIONS
// ============================================================================

/**
 * Clean up old files based on retention policy
 */
export async function cleanupOldFiles(): Promise<number> {
  try {
    const files = await fs.readdir(STORAGE_PATH);
    const now = Date.now();
    const maxAge = FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(STORAGE_PATH, file);
      const stats = await fs.stat(filePath);
      const fileAge = now - stats.mtime.getTime();

      if (fileAge > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
        console.log(`🧹 Cleaned up old file: ${file}`);
      }
    }

    console.log(`🧹 Cleanup completed: ${deletedCount} old files removed`);
    return deletedCount;
  } catch (error) {
    console.error("Failed to cleanup old files:", error);
    throw error;
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
  try {
    const files = await fs.readdir(STORAGE_PATH);
    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      const filePath = path.join(STORAGE_PATH, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
      fileCount++;
    }

    return {
      totalFiles: fileCount,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      storagePath: STORAGE_PATH,
      maxFileSizeMB: (MAX_FILE_SIZE / (1024 * 1024)).toFixed(2),
      retentionDays: FILE_RETENTION_DAYS,
    };
  } catch (error) {
    console.error("Failed to get storage stats:", error);
    throw error;
  }
}

// ============================================================================
// STREAMING SUPPORT (for future large file handling)
// ============================================================================

/**
 * Create read stream for large files
 */
export async function createReadStream(filename: string): Promise<NodeJS.ReadableStream> {
  const filePath = path.join(STORAGE_PATH, filename);
  const fsSync = await import("fs");
  return fsSync.createReadStream(filePath) as unknown as NodeJS.ReadableStream;
}

/**
 * Create write stream for large files
 */
export async function createWriteStream(filename: string): Promise<NodeJS.WritableStream> {
  const filePath = path.join(STORAGE_PATH, filename);
  const fsSync = await import("fs");
  return fsSync.createWriteStream(filePath) as unknown as NodeJS.WritableStream;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Storage health check
 */
export async function healthCheck(): Promise<StorageHealthCheck> {
  try {
    // Test directory access
    await fs.access(STORAGE_PATH);

    // Test write access
    const testFile = path.join(STORAGE_PATH, ".health-check");
    await fs.writeFile(testFile, "test");
    await fs.unlink(testFile);

    // Get storage stats
    const stats = await getStorageStats();

    return {
      status: "healthy",
      storage: "accessible",
      stats,
    };
  } catch (error) {
    const err = error as Error;
    return {
      status: "unhealthy",
      storage: "inaccessible",
      error: err.message,
    };
  }
}
