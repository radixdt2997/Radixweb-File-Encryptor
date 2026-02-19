/**
 * Test Email Route - POST /api/test-email
 *
 * Test email configuration by sending a test email.
 * For development/testing purposes only.
 */

import express from "express";
import { body, validationResult } from "express-validator";
import { server } from "../config.js";
import { sendError } from "../lib/errorResponse.js";
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
    if (server.nodeEnv === "production") {
      return sendError(res, 403, "Forbidden", "Test email endpoint not available in production");
    }

    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(res, 400, "Validation Error", "Invalid email address", errors.array());
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

      sendError(
        res,
        500,
        "Email Test Failed",
        "Failed to send test email",
        server.nodeEnv === "development" ? error.message : undefined,
      );
    }
  },
);

export default router;
