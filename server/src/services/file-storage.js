/**
 * File Storage Service
 *
 * Handles secure storage and retrieval of encrypted files.
 * Currently implements local disk storage, easily extensible to S3/cloud storage.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '../../data/uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB
const FILE_RETENTION_DAYS = parseInt(process.env.FILE_RETENTION_DAYS) || 30;

// ============================================================================
// DIRECTORY MANAGEMENT
// ============================================================================

/**
 * Ensure all required directories exist
 */
export async function ensureDirectories() {
  const dirs = [
    STORAGE_PATH,
    path.join(__dirname, '../../data'),
    path.join(__dirname, '../../logs')
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

/**
 * Generate unique filename for stored file
 */
function generateUniqueFilename(originalFilename) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalFilename) || '.enc';
  return `${timestamp}-${random}${extension}`;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Save uploaded encrypted file to storage
 */
export async function saveFile(fileBuffer, originalFilename, metadata = {}) {
  try {
    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size ${fileBuffer.length} exceeds maximum ${MAX_FILE_SIZE}`);
    }

    // Generate unique filename
    const filename = generateUniqueFilename(originalFilename);
    const filePath = path.join(STORAGE_PATH, filename);

    // Write file to disk
    await fs.writeFile(filePath, fileBuffer);

    // Verify file was written correctly
    const stats = await fs.stat(filePath);
    if (stats.size !== fileBuffer.length) {
      throw new Error('File write verification failed');
    }

    console.log(`💾 Saved file: ${filename} (${fileBuffer.length} bytes)`);

    return {
      filename,
      path: filePath,
      size: fileBuffer.length,
      savedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
}

/**
 * Read file from storage
 */
export async function readFile(filename) {
  try {
    const filePath = path.join(STORAGE_PATH, filename);

    // Check if file exists
    await fs.access(filePath);

    // Read file
    const buffer = await fs.readFile(filePath);

    return buffer;

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('File not found');
    }
    console.error('Failed to read file:', error);
    throw error;
  }
}

/**
 * Delete file from storage
 */
export async function deleteFile(filename) {
  try {
    const filePath = path.join(STORAGE_PATH, filename);
    await fs.unlink(filePath);
    console.log(`🗑️  Deleted file: ${filename}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`File not found for deletion: ${filename}`);
      return false;
    }
    console.error('Failed to delete file:', error);
    throw error;
  }
}

/**
 * Get file metadata without reading content
 */
export async function getFileMetadata(filename) {
  try {
    const filePath = path.join(STORAGE_PATH, filename);
    const stats = await fs.stat(filePath);

    return {
      filename,
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      exists: true
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return { filename, exists: false };
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
export async function cleanupOldFiles() {
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
    console.error('Failed to cleanup old files:', error);
    throw error;
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
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
      retentionDays: FILE_RETENTION_DAYS
    };

  } catch (error) {
    console.error('Failed to get storage stats:', error);
    throw error;
  }
}

// ============================================================================
// STREAMING SUPPORT (for future large file handling)
// ============================================================================

/**
 * Create read stream for large files
 */
export function createReadStream(filename) {
  const filePath = path.join(STORAGE_PATH, filename);
  return fs.createReadStream(filePath);
}

/**
 * Create write stream for large files
 */
export function createWriteStream(filename) {
  const filePath = path.join(STORAGE_PATH, filename);
  return fs.createWriteStream(filePath);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Storage health check
 */
export async function healthCheck() {
  try {
    // Test directory access
    await fs.access(STORAGE_PATH);

    // Test write access
    const testFile = path.join(STORAGE_PATH, '.health-check');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);

    // Get storage stats
    const stats = await getStorageStats();

    return {
      status: 'healthy',
      storage: 'accessible',
      stats
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      storage: 'inaccessible',
      error: error.message
    };
  }
}