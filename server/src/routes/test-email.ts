/**
 * Test Email Route - POST /api/test-email
 *
 * Test email configuration by sending a test email.
 * For development/testing purposes only.
 */

import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { server } from "../config";
import { sendError } from "../lib/errorResponse";
import { sendTestEmail } from "../services/email";
import type { TestEmailRequest, TestEmailResponse } from "../types/api";

const router: express.Router = express.Router();

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
  async (
    req: Request<
      {},
      TestEmailResponse | { error: string; message: string; details?: unknown },
      TestEmailRequest
    >,
    res: Response<
      TestEmailResponse | { error: string; message: string; details?: unknown }
    >,
  ) => {
    // Only allow in development
    if (server.nodeEnv === "production") {
      return sendError(
        res,
        403,
        "Forbidden",
        "Test email endpoint not available in production",
      );
    }

    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(
          res,
          400,
          "Validation Error",
          "Invalid email address",
          errors.array(),
        );
      }

      const { email } = req.body;

      // Send test email
      const result = await sendTestEmail(email);

      const response: TestEmailResponse = {
        success: true,
        message: "Test email sent successfully",
        messageId: result.messageId,
        to: email,
      };

      res.status(200).json(response);
      return;
    } catch (error) {
      console.error("Test email error:", error);

      return sendError(
        res,
        500,
        "Email Test Failed",
        "Failed to send test email",
        server.nodeEnv === "development" ? (error as Error).message : undefined,
      );
    }
  },
);

export default router;
