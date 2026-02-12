import express from "express";
import { param, validationResult } from "express-validator";
import {
  deleteRecipient,
  getRecipientsByFileId,
  logRecipientAuditEvent,
} from "../services/database.js";

const router = express.Router();

const fileIdParam = param("fileId")
  .matches(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
  )
  .withMessage("Valid file ID is required");

const recipientIdParam = param("recipientId")
  .isUUID(4)
  .withMessage("Valid recipient ID is required");

// GET /api/files/:fileId/recipients - list recipients for a file (sender-only in future)
router.get("/:fileId/recipients", fileIdParam, async (req, res) => {
  // Validate params
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation Error",
      message: "Invalid request parameters",
      details: errors.array(),
    });
  }

  const { fileId } = req.params;

  try {
    const recipients = await getRecipientsByFileId(fileId);

    const response = recipients.map((r) => ({
      id: r.id,
      email: r.email,
      otpAttempts: r.otp_attempts,
      createdAt: r.created_at,
      downloadedAt: r.downloaded_at,
      otpVerifiedAt: r.otp_verified_at,
    }));

    return res.status(200).json({ recipients: response });
  } catch (error) {
    console.error("Error listing recipients:", error);
    return res.status(500).json({
      error: "Recipient Listing Failed",
      message: "Failed to fetch recipients for this file",
    });
  }
});

// DELETE /api/files/:fileId/recipients/:recipientId - revoke access (by deleting recipient)
router.delete(
  "/:fileId/recipients/:recipientId",
  [fileIdParam, recipientIdParam],
  async (req, res) => {
    // Validate params
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid request parameters",
        details: errors.array(),
      });
    }

    const { fileId, recipientId } = req.params;

    try {
      await logRecipientAuditEvent(
        fileId,
        recipientId,
        "revoked",
        req.ip,
        req.get("User-Agent"),
        {},
      );

      // Hard delete recipient for now (simple revocation)
      // Note: future enhancement could use a 'revoked_at' field instead.
      await deleteRecipient(fileId, recipientId);

      return res.status(200).json({
        success: true,
        message: "Recipient access revoked",
      });
    } catch (error) {
      console.error("Error revoking recipient:", error);
      return res.status(500).json({
        error: "Recipient Revocation Failed",
        message: "Failed to revoke recipient access",
      });
    }
  },
);

export default router;
