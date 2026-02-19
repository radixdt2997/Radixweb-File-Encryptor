/**
 * Metadata Route - GET /api/metadata/:fileId
 *
 * Returns file metadata without requiring authentication.
 * Used by recipient to display file info before OTP entry.
 */

import express from "express";
import type { Request, Response } from "express";
import { param, validationResult } from "express-validator";
import { server } from "../config";
import { sendError } from "../lib/errorResponse";
import {
  getFileById,
  isFileExpired,
  logAuditEvent,
} from "../services/database";
import type { MetadataResponse } from "../types/api";

const router: express.Router = express.Router();

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const metadataValidation = [
  param("fileId")
    .matches(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
    )
    .withMessage("Valid file ID is required"),
];

// ============================================================================
// METADATA ENDPOINT
// ============================================================================

router.get(
  "/:fileId",
  metadataValidation,
  async (
    req: Request<{ fileId: string }>,
    res: Response<MetadataResponse | { error: string; message: string; details?: unknown }>,
  ) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(res, 400, "Validation Error", "Invalid file ID format", errors.array());
      }

      const { fileId } = req.params;
      const clientIP = req.ip || "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      // Retrieve file record
      const file = await getFileById(fileId);
      if (!file) {
        await logAuditEvent(fileId, "otp_requested", clientIP, userAgent, {
          found: false,
        });

        return sendError(res, 404, "File Not Found", "The requested file does not exist");
      }

      // Check if file is expired
      if (await isFileExpired(fileId)) {
        await logAuditEvent(fileId, "otp_requested", clientIP, userAgent, {
          found: true,
          expired: true,
          expiryTime: file.expiry_time,
        });

        return sendError(res, 404, "File Not Found", "The requested file does not exist");
      }

      // Log metadata access (for analytics)
      await logAuditEvent(fileId, "otp_requested", clientIP, userAgent, {
        found: true,
        fileName: file.file_name,
        fileSize: file.file_size,
        expiryType: file.expiry_type,
      });

      // Return metadata (public information)
      const response: MetadataResponse = {
        fileName: file.file_name,
        fileSize: file.file_size,
        expiryTime: file.expiry_time,
        expiryType: file.expiry_type,
        uploadedAt: file.created_at,
      };

      res.status(200).json(response);
      return;
    } catch (error) {
      console.error("Metadata error:", error);

      // Log error
      await logAuditEvent(
        req.params.fileId,
        "metadata_error",
        req.ip || "unknown",
        req.get("User-Agent") || "unknown",
        {
          error: (error as Error).message,
        },
      );

      return sendError(
        res,
        500,
        "Metadata Error",
        "Failed to retrieve file metadata",
        server.nodeEnv === "development" ? (error as Error).message : undefined,
      );
    }
  },
);

export default router;
