/**
 * Upload Route - POST /api/upload
 *
 * Handles encrypted file uploads with OTP-based key wrapping.
 * Server stores encrypted file and wrapped key, sends separate emails for link and OTP.
 */

import crypto from "crypto";
import express from "express";
import { body, validationResult } from "express-validator";
import {
  createFileRecord,
  createRecipientRecord,
  logAuditEvent,
  logRecipientAuditEvent,
} from "../services/database.js";
import { sendDownloadLinkEmail, sendOTPEmail } from "../services/email.js";
import { saveFile } from "../services/file-storage.js";

const router = express.Router();
const RADIX_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@radixweb\.com$/;

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const uploadValidation = [
  body("fileName")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("File name is required and must be less than 255 characters"),

  // Legacy single-recipient fields (optional in Phase 3)
  body("recipientEmail")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid recipient email is required"),

  body("otpHash")
    .optional()
    .matches(/^[A-Za-z0-9+/=]{44}$/) // SHA-256 base64 is always 44 chars
    .withMessage("Valid OTP hash is required"),

  body("otp")
    .optional()
    .matches(/^[0-9]{6}$/)
    .withMessage("Valid 6-digit OTP is required"),

  body("expiryMinutes")
    .isInt({ min: 5, max: 1440 }) // 5 minutes to 24 hours
    .withMessage("Expiry minutes must be between 5 and 1440"),

  body("expiryType")
    .isIn(["one-time", "time-based"])
    .withMessage('Expiry type must be "one-time" or "time-based"'),

  // New: recipients JSON payload (optional but validated if present)
  body("recipients")
    .optional()
    .custom((value) => {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("Recipients must be a non-empty array");
        }
        for (const r of parsed) {
          if (
            !r.email ||
            !r.otpHash ||
            !r.wrappedKey ||
            !r.wrappedKeySalt
          ) {
            throw new Error(
              "Each recipient must include email, otpHash, wrappedKey, wrappedKeySalt",
            );
          }
        }
        return true;
      } catch (err) {
        throw new Error("Invalid recipients payload");
      }
    }),
];

// ============================================================================
// UPLOAD ENDPOINT
// ============================================================================

router.post("/", uploadValidation, async (req, res) => {
  console.log("[UPLOAD] Handler entered");
  const startTime = Date.now();
  let fileId = null;

  // Check validation errors
  const errors = validationResult(req);

  console.log("[UPLOAD] Validation results:", errors);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation Error",
      message: "Invalid request data",
      details: errors.array(),
    });
  }

  try {
    // Extract and validate request data
    const { fileName, expiryMinutes, expiryType } = req.body;
    console.log("[UPLOAD] Request body:", req.body);

    // Check if files were uploaded

    if (
      !req.files ||
      !req.files.encryptedData ||
      !req.files.wrappedKey ||
      !req.files.wrappedKeySalt
    ) {
      console.error("[UPLOAD] Missing files:", req.files);
      return res.status(400).json({
        error: "Files Required",
        message: "Encrypted file data, wrapped key, and salt are all required",
      });
    }

    const encryptedDataFile = req.files.encryptedData[0];
    const wrappedKeyFile = req.files.wrappedKey[0];
    const wrappedKeySaltFile = req.files.wrappedKeySalt[0];
    console.log("[UPLOAD] Received files:", {
      encryptedDataFile: encryptedDataFile?.originalname,
      wrappedKeyFile: wrappedKeyFile?.originalname,
      wrappedKeySaltFile: wrappedKeySaltFile?.originalname,
    });

    // Validate file sizes

    const maxFileSize =
      parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024;
    if (encryptedDataFile.size > maxFileSize) {
      console.error("[UPLOAD] File too large:", encryptedDataFile.size);
      return res.status(413).json({
        error: "File Too Large",
        message: `File size ${encryptedDataFile.size} exceeds maximum ${maxFileSize / (1024 * 1024)}MB`,
      });
    }

    // Generate unique file ID
    fileId = crypto.randomUUID();
    console.log("[UPLOAD] Generated fileId:", fileId);

    // Save encrypted file to storage
    const fileResult = await saveFile(
      encryptedDataFile.buffer,
      fileName,
      {
        expiryMinutes,
        expiryType,
      },
    );
    console.log("[UPLOAD] File saved:", fileResult);

    // Extract binary data from uploaded files
    const wrappedKeyBuffer = wrappedKeyFile.buffer;
    const wrappedKeySaltBuffer = wrappedKeySaltFile.buffer;

    // Determine recipients payload (Phase 3 multi-recipient)
    let recipientsPayload = [];

    if (req.body.recipients) {
      const parsed = JSON.parse(req.body.recipients);
      recipientsPayload = parsed;
    } else if (
      req.body.recipientEmail &&
      req.body.otp &&
      req.body.otpHash
    ) {
      // Legacy single-recipient path
      recipientsPayload = [
        {
          email: req.body.recipientEmail,
          otp: req.body.otp,
          otpHash: req.body.otpHash,
          wrappedKey: Buffer.from(wrappedKeyBuffer).toString("base64"),
          wrappedKeySalt: Buffer.from(wrappedKeySaltBuffer).toString("base64"),
        },
      ];
    } else {
      return res.status(400).json({
        error: "Validation Error",
        message: "At least one recipient is required",
      });
    }

    // Backend domain whitelist enforcement
    const invalidDomainRecipients = recipientsPayload.filter(
      (r) => !RADIX_EMAIL_REGEX.test(r.email),
    );
    if (invalidDomainRecipients.length > 0) {
      return res.status(400).json({
        error: "Invalid email domain",
        message: "Only @radixweb.com emails are allowed",
        invalidEmails: invalidDomainRecipients.map((r) => r.email),
      });
    }

    // Use first recipient's email for legacy files.recipient_email (NOT NULL)
    const primaryRecipientEmail = recipientsPayload[0].email;

    // Create database record (legacy fields kept for backward compatibility)
    const recordId = await createFileRecord({
      fileId,
      fileName,
      filePath: fileResult.filename, // Store relative path
      fileSize: fileResult.size,
      recipientEmail: primaryRecipientEmail,
      wrappedKey: wrappedKeyBuffer,
      wrappedKeySalt: wrappedKeySaltBuffer,
      otpHash: recipientsPayload[0].otpHash,
      expiryMinutes,
      expiryType,
    });
    console.log("[UPLOAD] DB record created:", recordId);

    // Create per-recipient records
    const recipientIds = [];
    for (const recipient of recipientsPayload) {
      const recipientId = await createRecipientRecord({
        fileId,
        email: recipient.email,
        otpHash: recipient.otpHash,
        wrappedKey: recipient.wrappedKey,
        wrappedKeySalt: recipient.wrappedKeySalt,
      });
      recipientIds.push({ id: recipientId, email: recipient.email, otp: recipient.otp });
    }

    // Generate download URL
    const baseUrl = process.env.BASE_URL || "http://localhost:5173";
    const downloadUrl = `${baseUrl}?fileId=${fileId}`;

    // Log successful upload
    await logAuditEvent(fileId, "upload", req.ip, req.get("User-Agent"), {
      fileName,
      fileSize: fileResult.size,
      recipientCount: recipientsPayload.length,
      expiryMinutes,
      expiryType,
      processingTimeMs: Date.now() - startTime,
    });

    // Prepare base fileBody for emails
    const fileBody = {
      fileName,
      fileSize: fileResult.size,
      downloadUrl,
      expiryMinutes,
    };
    console.log("[UPLOAD] fileBody for email:", {
      ...fileBody,
      otp: "[REDACTED]",
    });

    // Send emails asynchronously (don't block response)
    setImmediate(async () => {
      try {
        // Send per-recipient emails
        for (const recipient of recipientIds) {
          const recipientFileBody = {
            ...fileBody,
            otp: recipient.otp,
          };

          // Send download link email
          await sendDownloadLinkEmail(recipient.email, recipientFileBody);

          // Send OTP email (separate channel for security)
          await sendOTPEmail(recipient.email, recipientFileBody);

          // Per-recipient audit logging
          await logRecipientAuditEvent(
            fileId,
            recipient.id,
            "otp_sent",
            req.ip,
            req.get("User-Agent"),
            {
              email: recipient.email,
            },
          );
        }

        console.log(`📧 Emails sent for file ${fileId}`);
      } catch (emailError) {
        console.error("Failed to send emails:", emailError);
        // Log email failure but don't affect upload success
        await logAuditEvent(
          fileId,
          "email_failed",
          req.ip,
          req.get("User-Agent"),
          {
            error: emailError.message,
          },
        );
      }
    });

    // Return success response
    res.status(200).json({
      fileId,
      downloadUrl,
      message:
        "File uploaded successfully. Download link and OTP sent to recipient.",
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString(),
    });

    console.log(
      `✅ File uploaded: ${fileId} (${fileResult.size} bytes) for ${primaryRecipientEmail}`,
    );
  } catch (error) {
    console.error("Upload error:", error);

    // Log failed upload
    await logAuditEvent(
      fileId || "unknown",
      "upload_failed",
      req.ip,
      req.get("User-Agent"),
      {
      error: error.message,
      processingTimeMs: Date.now() - startTime,
      },
    );

    res.status(500).json({
      error: "Upload Failed",
      message: "Failed to process file upload",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
