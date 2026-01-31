/**
 * Test Email Route - POST /api/test-email
 *
 * Test email configuration by sending a test email.
 * For development/testing purposes only.
 */

import express from "express";
import { body, validationResult } from "express-validator";
import { sendTestEmail } from "../services/email.js";

const router = express.Router();

// ============================================================================
// TEST EMAIL ENDPOINT (Development Only)
// ============================================================================

router.post(
  "/",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email address is required"),
  ],
  async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Test email endpoint not available in production",
      });
    }

    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Invalid email address",
          details: errors.array(),
        });
      }

      const { email } = req.body;

      // Send test email
      const result = await sendTestEmail(email);

      res.status(200).json({
        success: true,
        message: "Test email sent successfully",
        messageId: result.messageId,
        to: email,
      });
    } catch (error) {
      console.error("Test email error:", error);

      res.status(500).json({
        error: "Email Test Failed",
        message: "Failed to send test email",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

export default router;
