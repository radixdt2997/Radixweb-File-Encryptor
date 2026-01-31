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
  incrementOTPAttempts,
  isFileExpired,
  logAuditEvent,
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
    .withMessage("OTP must be exactly 6 digits"),
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

    const { fileId, otp } = req.body;
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

    // Check attempt limits
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
    if (file.otp_attempts >= maxAttempts) {
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "too_many_attempts",
        attempts: file.otp_attempts,
      });

      return res.status(400).json({
        error: "Too Many Attempts",
        message: "Maximum OTP attempts exceeded",
      });
    }

    // Check cooldown between attempts
    const cooldownMs = parseInt(process.env.OTP_COOLDOWN_MS) || 5000; // 5 seconds default
    if (file.last_attempt_at) {
      const lastAttempt = new Date(file.last_attempt_at);
      const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();

      if (timeSinceLastAttempt < cooldownMs) {
        const remainingCooldown = Math.ceil(
          (cooldownMs - timeSinceLastAttempt) / 1000,
        );

        await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
          reason: "cooldown_active",
          remainingSeconds: remainingCooldown,
        });

        return res.status(429).json({
          error: "Too Many Attempts",
          message: `Please wait ${remainingCooldown} seconds before trying again`,
        });
      }
    }

    // Increment attempt counter
    await incrementOTPAttempts(fileId);

    // Hash the provided OTP (timing attack protection)
    const providedOtpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("base64");

    // Constant-time comparison to prevent timing attacks
    const storedHash = file.otp_hash;
    const isValidOTP = crypto.timingSafeEqual(
      Buffer.from(providedOtpHash, "base64"),
      Buffer.from(storedHash, "base64"),
    );

    if (!isValidOTP) {
      // Log failed attempt
      await logAuditEvent(fileId, "otp_failed", clientIP, userAgent, {
        reason: "invalid_otp",
        attempts: file.otp_attempts + 1,
      });

      return res.status(400).json({
        error: "Invalid OTP",
        message: "The provided OTP is incorrect",
        attemptsRemaining: Math.max(0, maxAttempts - (file.otp_attempts + 1)),
      });
    }

    // OTP is valid! Log success and return wrapped key
    await logAuditEvent(fileId, "otp_verified", clientIP, userAgent, {
      attempts: file.otp_attempts + 1,
      processingTimeMs: Date.now() - startTime,
    });

    // Return the wrapped key data (convert binary to base64)
    res.status(200).json({
      wrappedKey: Buffer.from(file.wrapped_key).toString("base64"),
      wrappedKeySalt: Buffer.from(file.wrapped_key_salt).toString("base64"),
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
