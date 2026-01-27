/**
 * Upload Route - POST /api/upload
 *
 * Handles encrypted file uploads with OTP-based key wrapping.
 * Server stores encrypted file and wrapped key, sends separate emails for link and OTP.
 */

import express from "express";
import crypto from "crypto";
import { body, validationResult } from "express-validator";
import { saveFile } from "../services/file-storage.js";
import { createFileRecord, logAuditEvent } from "../services/database.js";
import { sendDownloadLinkEmail, sendOTPEmail } from "../services/email.js";

const router = express.Router();

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const uploadValidation = [
  body("fileName")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("File name is required and must be less than 255 characters"),

  body("recipientEmail")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid recipient email is required"),

  body("otpHash")
    .matches(/^[A-Za-z0-9+/=]{44}$/) // SHA-256 base64 is always 44 chars
    .withMessage("Valid OTP hash is required"),

  body("expiryMinutes")
    .isInt({ min: 5, max: 1440 }) // 5 minutes to 24 hours
    .withMessage("Expiry minutes must be between 5 and 1440"),

  body("expiryType")
    .isIn(["one-time", "time-based"])
    .withMessage('Expiry type must be "one-time" or "time-based"'),
];

// ============================================================================
// UPLOAD ENDPOINT
// ============================================================================

router.post("/", uploadValidation, async (req, res) => {
  console.log("[UPLOAD] Handler entered");
  const startTime = Date.now();

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
    const { fileName, recipientEmail, otpHash, expiryMinutes, expiryType } =
      req.body;
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
    const fileId = crypto.randomUUID();
    console.log("[UPLOAD] Generated fileId:", fileId);

    // Save encrypted file to storage
    const fileResult = await saveFile(encryptedDataFile.buffer, fileName, {
      recipientEmail,
      expiryMinutes,
      expiryType,
    });
    console.log("[UPLOAD] File saved:", fileResult);

    // Extract binary data from uploaded files
    const wrappedKeyBuffer = wrappedKeyFile.buffer;
    const wrappedKeySaltBuffer = wrappedKeySaltFile.buffer;

    // Create database record
    const recordId = await createFileRecord({
      fileId,
      fileName,
      filePath: fileResult.filename, // Store relative path
      fileSize: fileResult.size,
      recipientEmail,
      wrappedKey: wrappedKeyBuffer,
      wrappedKeySalt: wrappedKeySaltBuffer,
      otpHash,
      expiryMinutes,
      expiryType,
    });
    console.log("[UPLOAD] DB record created:", recordId);

    // Generate download URL
    const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const downloadUrl = `${baseUrl}?fileId=${fileId}`;

    // Log successful upload
    await logAuditEvent(fileId, "upload", req.ip, req.get("User-Agent"), {
      fileName,
      fileSize: fileResult.size,
      recipientEmail,
      expiryMinutes,
      expiryType,
      processingTimeMs: Date.now() - startTime,
    });

    // Prepare fileBody for emails
    const fileBody = {
      fileName,
      fileSize: fileResult.size,
      downloadUrl,
      expiryMinutes,
    };
    console.log("[UPLOAD] fileBody for email:", fileBody);

    // Send emails asynchronously (don't block response)
    setImmediate(async () => {
      try {
        // Send download link email
        await sendDownloadLinkEmail(recipientEmail, fileBody);

        // Send OTP email (separate channel for security)
        await sendOTPEmail(recipientEmail, fileBody);

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
      `✅ File uploaded: ${fileId} (${fileResult.size} bytes) for ${recipientEmail}`,
    );
  } catch (error) {
    console.error("Upload error:", error);

    // Log failed upload
    await logAuditEvent(null, "upload_failed", req.ip, req.get("User-Agent"), {
      error: error.message,
      processingTimeMs: Date.now() - startTime,
    });

    res.status(500).json({
      error: "Upload Failed",
      message: "Failed to process file upload",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
