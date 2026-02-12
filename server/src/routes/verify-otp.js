/**
 * OTP Verification Route - POST /api/verify-otp
 *
 * Verifies OTP and returns wrapped key for file decryption.
 * Implements timing attack protection and attempt limiting.
 */

import crypto from "crypto";
import express from "express";
import { body, validationResult } from "express-validator";
import {
  getFileById,
  getRecipientByFileAndEmail,
  incrementOTPAttempts,
  incrementRecipientOTPAttempts,
  isFileExpired,
  logAuditEvent,
  logRecipientAuditEvent,
} from "../services/database.js";

const router = express.Router();

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const otpValidation = [
  body("fileId")
    .matches(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
    )
    .withMessage("Valid file ID is required"),

  body("otp")
    .matches(/^[0-9]{6}$/)
    .withMessage("OTP must be exactly 6 digits")
    .trim(),

  body("recipientEmail")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid recipient email is required when provided")
    .trim(),
];

// ============================================================================
// OTP VERIFICATION ENDPOINT
// ============================================================================

router.post("/", otpValidation, async (req, res) => {
  const startTime = Date.now();

  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid request data",
        details: errors.array(),
      });
    }

    const { fileId, otp, recipientEmail } = req.body;
    const clientIP = req.ip;
    const userAgent = req.get("User-Agent");

    // Retrieve file record
    const file = await getFileById(fileId);
    if (!file) {
      // Log invalid file ID attempt
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "file_not_found",
        otpProvided: otp ? "yes" : "no",
      });

      return res.status(400).json({
        error: "Invalid Request",
        message: "File not found or expired",
      });
    }

    // Check if file is expired
    if (await isFileExpired(fileId)) {
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "file_expired",
        expiryTime: file.expiry_time,
      });

      return res.status(400).json({
        error: "File Expired",
        message: "This file has expired and is no longer available",
      });
    }

    // Check if one-time file was already downloaded
    if (file.expiry_type === "one-time" && file.status === "used") {
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "already_used",
      });

      return res.status(400).json({
        error: "File Already Used",
        message: "This file has already been downloaded",
      });
    }

    // Determine whether to use recipient-specific verification (Phase 3)
    let otpContext = {
      otpAttempts: file.otp_attempts,
      lastAttemptAt: file.last_attempt_at,
      otpHash: file.otp_hash,
      wrappedKey: file.wrapped_key,
      wrappedKeySalt: file.wrapped_key_salt,
      mode: "file",
      recipientId: null,
      email: null,
    };

    if (recipientEmail) {
      const recipient = await getRecipientByFileAndEmail(
        fileId,
        recipientEmail,
      );
      if (!recipient) {
        // Always add constant delay to prevent timing attacks that reveal email presence
        const delay = Math.random() * 100 + 50; // 50-150ms
        await new Promise((resolve) => setTimeout(resolve, delay));

        await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
          reason: "recipient_not_found",
          email: recipientEmail,
        });

        await logRecipientAuditEvent(
          fileId,
          "unknown",
          "otp_failed",
          clientIP,
          userAgent,
          {
            reason: "recipient_not_found",
            email: recipientEmail,
          },
        );

        return res.status(400).json({
          error: "Invalid Recipient",
          message: "Recipient not found for this file",
        });
      }

      // Constant-time email comparison to prevent timing attacks
      try {
        crypto.timingSafeEqual(
          Buffer.from(recipient.email),
          Buffer.from(recipientEmail),
        );
      } catch (e) {
        // Email mismatch - should not happen since we fetched by email, but check for safety
        const delay = Math.random() * 100 + 50;
        await new Promise((resolve) => setTimeout(resolve, delay));

        await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
          reason: "email_mismatch",
          email: recipientEmail,
        });

        return res.status(400).json({
          error: "Invalid Recipient",
          message: "Recipient not found for this file",
        });
      }

      otpContext = {
        otpAttempts: recipient.otp_attempts,
        lastAttemptAt: recipient.last_attempt_at,
        otpHash: recipient.otp_hash,
        wrappedKey: recipient.wrapped_key,
        wrappedKeySalt: recipient.wrapped_key_salt,
        mode: "recipient",
        recipientId: recipient.id,
        email: recipient.email,
      };
    }

    // Check attempt limits
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
    if (otpContext.otpAttempts >= maxAttempts) {
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "too_many_attempts",
        attempts: otpContext.otpAttempts,
        scope: otpContext.mode,
      });

      if (otpContext.mode === "recipient" && otpContext.recipientId) {
        await logRecipientAuditEvent(
          fileId,
          otpContext.recipientId,
          "otp_failed",
          clientIP,
          userAgent,
          {
            reason: "too_many_attempts",
            attempts: otpContext.otpAttempts,
          },
        );
      }

      return res.status(400).json({
        error: "Too Many Attempts",
        message: "Maximum OTP attempts exceeded",
      });
    }

    // Check cooldown between attempts
    const cooldownMs = parseInt(process.env.OTP_COOLDOWN_MS) || 5000; // 5 seconds default
    if (otpContext.lastAttemptAt) {
      const lastAttempt = new Date(otpContext.lastAttemptAt);
      const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();

      if (timeSinceLastAttempt < cooldownMs) {
        const remainingCooldown = Math.ceil(
          (cooldownMs - timeSinceLastAttempt) / 1000,
        );

        await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
          reason: "cooldown_active",
          remainingSeconds: remainingCooldown,
          scope: otpContext.mode,
        });

        if (otpContext.mode === "recipient" && otpContext.recipientId) {
          await logRecipientAuditEvent(
            fileId,
            otpContext.recipientId,
            "otp_failed",
            clientIP,
            userAgent,
            {
              reason: "cooldown_active",
              remainingSeconds: remainingCooldown,
            },
          );
        }

        return res.status(429).json({
          error: "Too Many Attempts",
          message: `Please wait ${remainingCooldown} seconds before trying again`,
        });
      }
    }

    // Increment attempt counter
    if (otpContext.mode === "recipient" && otpContext.recipientId) {
      await incrementRecipientOTPAttempts(otpContext.recipientId);
      otpContext.otpAttempts += 1;
    } else {
      await incrementOTPAttempts(fileId);
      otpContext.otpAttempts += 1;
    }

    // Hash the provided OTP (timing attack protection)
    const providedOtpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("base64");

    // Constant-time comparison to prevent timing attacks
    const storedHash = otpContext.otpHash;
    const isValidOTP = crypto.timingSafeEqual(
      Buffer.from(providedOtpHash, "base64"),
      Buffer.from(storedHash, "base64"),
    );

    if (!isValidOTP) {
      // Log failed attempt
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "invalid_otp",
        attempts: otpContext.otpAttempts,
        scope: otpContext.mode,
      });

      if (otpContext.mode === "recipient" && otpContext.recipientId) {
        await logRecipientAuditEvent(
          fileId,
          otpContext.recipientId,
          "otp_failed",
          clientIP,
          userAgent,
          {
            reason: "invalid_otp",
            attempts: otpContext.otpAttempts,
          },
        );
      }

      return res.status(400).json({
        error: "Invalid OTP",
        message: "The provided OTP is incorrect",
        attemptsRemaining: Math.max(0, maxAttempts - otpContext.otpAttempts),
      });
    }

    // OTP is valid! Log success and return wrapped key
    await logAuditEvent(fileId, "otp_verified", clientIP, userAgent, {
      attempts: otpContext.otpAttempts,
      processingTimeMs: Date.now() - startTime,
      scope: otpContext.mode,
      recipientEmail: otpContext.email,
    });

    if (otpContext.mode === "recipient" && otpContext.recipientId) {
      await logRecipientAuditEvent(
        fileId,
        otpContext.recipientId,
        "otp_verified",
        clientIP,
        userAgent,
        {
          attempts: otpContext.otpAttempts,
          processingTimeMs: Date.now() - startTime,
          email: otpContext.email,
          fileSize: file.file_size,
        },
      );
    }

    // Return the wrapped key data.
    // For legacy file-level data, wrappedKey / wrappedKeySalt are Buffers.
    // For multi-recipient data, they're already base64 strings.
    const normalizeToBase64 = (value) => {
      if (Buffer.isBuffer(value)) {
        return value.toString("base64");
      }
      if (typeof value === "string") {
        return value;
      }
      // Fallback for unexpected types
      return Buffer.from(value).toString("base64");
    };

    res.status(200).json({
      wrappedKey: normalizeToBase64(otpContext.wrappedKey),
      wrappedKeySalt: normalizeToBase64(otpContext.wrappedKeySalt),
      fileName: file.file_name,
      fileSize: file.file_size,
      verifiedAt: new Date().toISOString(),
    });

    console.log(`🔐 OTP verified for file ${fileId} (${file.file_name})`);
  } catch (error) {
    console.error("OTP verification error:", error);

    // Log error (without sensitive details)
    await logAuditEvent(
      req.body.fileId || "unknown",
      "otp_failed",
      req.ip,
      req.get("User-Agent"),
      {
        error: error.message,
        processingTimeMs: Date.now() - startTime,
      },
    );

    res.status(500).json({
      error: "Verification Failed",
      message: "Failed to verify OTP",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
