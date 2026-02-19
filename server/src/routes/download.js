/**
 * Download Route - GET /api/download/:fileId
 *
 * Serves encrypted files for download after OTP verification.
 * Called by client after successful OTP verification.
 */

import express from "express";
import { param, validationResult } from "express-validator";
import { server } from "../config.js";
import { sendError } from "../lib/errorResponse.js";
import {
  getFileById,
  isFileExpired,
  logAuditEvent,
  updateFileStatus,
  getRecipientsByFileId,
  updateRecipientRecord,
  logRecipientAuditEvent,
} from "../services/database.js";
import { readFile } from "../services/file-storage.js";

const router = express.Router();

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const downloadValidation = [
  param("fileId")
    .matches(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
    )
    .withMessage("Valid file ID is required"),
];

// ============================================================================
// DOWNLOAD ENDPOINT
// ============================================================================

router.get("/:fileId", downloadValidation, async (req, res) => {
  const startTime = Date.now();

  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, "Validation Error", "Invalid file ID format", errors.array());
    }

    const { fileId } = req.params;
    const clientIP = req.ip;
    const userAgent = req.get("User-Agent");

    // Retrieve file record
    const file = await getFileById(fileId);
    if (!file) {
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "file_not_found",
      });

      return sendError(res, 404, "File Not Found", "The requested file does not exist");
    }

    // Check if file is expired
    if (await isFileExpired(fileId)) {
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "file_expired",
        expiryTime: file.expiry_time,
      });

      return sendError(res, 400, "File Expired", "This file has expired and is no longer available");
    }

    // Check if one-time file was already downloaded
    if (file.expiry_type === "one-time" && file.status === "used") {
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "already_used",
      });

      return sendError(res, 400, "File Already Used", "This file has already been downloaded");
    }

    // Read the encrypted file from storage
    const fileBuffer = await readFile(file.file_path);

    // Mark file as downloaded (for one-time files)
    if (file.expiry_type === "one-time") {
      await updateFileStatus(fileId, "used", {
        downloadedAt: new Date().toISOString(),
      });
    }

    // Update all recipients' download timestamps (per-recipient audit)
    const recipients = await getRecipientsByFileId(fileId);
    const now = new Date().toISOString();
    for (const recipient of recipients) {
      if (!recipient.downloaded_at) {
        await updateRecipientRecord(recipient.id, {
          downloaded_at: now,
        });

        await logRecipientAuditEvent(
          fileId,
          recipient.id,
          "download",
          clientIP,
          userAgent,
          {
            email: recipient.email,
            fileSize: fileBuffer.length,
            expiryType: file.expiry_type,
            processingTimeMs: Date.now() - startTime,
          },
        );
      }
    }

    // Log successful download
    await logAuditEvent(fileId, "download", clientIP, userAgent, {
      fileSize: fileBuffer.length,
      recipientCount: recipients.length,
      processingTimeMs: Date.now() - startTime,
    });

    // Set response headers
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.file_name}"`,
    );
    res.setHeader("Content-Length", fileBuffer.length);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Send the encrypted file
    res.send(fileBuffer);

    console.log(
      `📥 File downloaded: ${fileId} (${file.file_name}, ${fileBuffer.length} bytes)`,
    );
  } catch (error) {
    console.error("Download error:", error);

    // Log download error
    await logAuditEvent(
      req.params.fileId,
      "download_error",
      req.ip,
      req.get("User-Agent"),
      {
        error: error.message,
        processingTimeMs: Date.now() - startTime,
      },
    );

    if (error.message === "File not found") {
      return sendError(res, 404, "File Not Found", "The requested file could not be found");
    }

    sendError(
      res,
      500,
      "Download Failed",
      "Failed to download file",
      server.nodeEnv === "development" ? error.message : undefined,
    );
  }
});

export default router;
