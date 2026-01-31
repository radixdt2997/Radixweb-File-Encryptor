/**
 * Metadata Route - GET /api/metadata/:fileId
 *
 * Returns file metadata without requiring authentication.
 * Used by recipient to display file info before OTP entry.
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { getFileById, isFileExpired, logAuditEvent } from '../services/database.js';

const router = express.Router();

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const metadataValidation = [
  param('fileId')
    .matches(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i)
    .withMessage('Valid file ID is required')
];

// ============================================================================
// METADATA ENDPOINT
// ============================================================================

router.get('/:fileId', metadataValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid file ID format',
        details: errors.array()
      });
    }

    const { fileId } = req.params;
    const clientIP = req.ip;
    const userAgent = req.get('User-Agent');

    // Retrieve file record
    const file = await getFileById(fileId);
    if (!file) {
      await logAuditEvent(fileId, 'otp_requested', clientIP, userAgent, {
        found: false
      });

      return res.status(404).json({
        error: 'File Not Found',
        message: 'The requested file does not exist'
      });
    }

    // Check if file is expired
    if (await isFileExpired(fileId)) {
      await logAuditEvent(fileId, 'otp_requested', clientIP, userAgent, {
        found: true,
        expired: true,
        expiryTime: file.expiry_time
      });

      return res.status(404).json({
        error: 'File Not Found',
        message: 'The requested file does not exist'
      });
    }

    // Log metadata access (for analytics)
    await logAuditEvent(fileId, 'otp_requested', clientIP, userAgent, {
      found: true,
      fileName: file.file_name,
      fileSize: file.file_size,
      expiryType: file.expiry_type
    });

    // Return metadata (public information)
    res.status(200).json({
      fileName: file.file_name,
      fileSize: file.file_size,
      expiryTime: file.expiry_time,
      expiryType: file.expiry_type,
      uploadedAt: file.created_at
    });

  } catch (error) {
    console.error('Metadata error:', error);

    // Log error
    await logAuditEvent(req.params.fileId, 'metadata_error', req.ip, req.get('User-Agent'), {
      error: error.message
    });

    res.status(500).json({
      error: 'Metadata Error',
      message: 'Failed to retrieve file metadata',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;